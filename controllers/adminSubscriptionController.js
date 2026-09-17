const SubscriptionHistory = require('../models/SubscriptionHistory');
const Transaction = require('../models/Transaction');
const Customer = require('../models/Customer');
const Plan = require('../models/Plan');
const User = require('../models/User');

/**
 * @desc    Get all subscriptions with stats for admin tracking
 * @route   GET /api/admin/subscriptions
 * @access  Private (Admin)
 */
exports.getAllSubscriptions = async (req, res) => {
    try {
        const subscriptions = await SubscriptionHistory.find()
            .populate('user', 'name email phone status profilePic')
            .populate('customer', 'name contactPhone email')
            .populate('plan', 'name price durationDays jobPostLimit hiringLimit')
            .populate('activatedBy', 'name email')
            .sort({ createdAt: -1 });

        const now = new Date();
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(now.getDate() + 7);

        let totalSold = subscriptions.length;
        let activeCount = 0;
        let expiredCount = 0;
        let expiringSoonCount = 0;

        // Auto-update status and calculate metrics
        const updatedSubs = subscriptions.map(sub => {
            const isExpired = sub.endDate < now;
            const isExpiringSoon = sub.endDate >= now && sub.endDate <= sevenDaysFromNow;
            
            let currentStatus = sub.status;
            if (isExpired && currentStatus !== 'Expired') {
                currentStatus = 'Expired';
            }

            if (currentStatus === 'Active') activeCount++;
            if (currentStatus === 'Expired') expiredCount++;
            if (currentStatus === 'Active' && isExpiringSoon) expiringSoonCount++;

            return {
                ...sub._doc,
                status: currentStatus,
                isExpiringSoon
            };
        });

        res.status(200).json({
            success: true,
            stats: {
                totalSold,
                activeCount,
                expiredCount,
                expiringSoonCount
            },
            subscriptions: updatedSubs
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Admin directly activates a plan for a customer (offline payment)
 * @route   POST /api/admin/activate-plan
 * @access  Private (Admin / Lead Manager)
 *
 * Body:
 *   customerId      - Customer._id
 *   planId          - Plan._id
 *   amountPaid      - Number (can be 0 for complimentary)
 *   paymentMethod   - cash | upi | bank_transfer | cheque | complimentary | other
 *   paymentReference- optional string (UPI txn ID, cheque no., etc.)
 *   paymentNote     - optional note
 *   startDate       - optional ISO date string (default: now)
 */
exports.adminActivatePlan = async (req, res) => {
    try {
        const {
            customerId,
            planId,
            amountPaid,
            paymentMethod = 'cash',
            paymentReference = '',
            paymentNote = '',
            startDate
        } = req.body;

        // ── 1. Validate inputs ──────────────────────────────────────────
        if (!customerId || !planId || amountPaid === undefined || amountPaid === null) {
            return res.status(400).json({
                success: false,
                message: 'customerId, planId aur amountPaid required hain'
            });
        }

        // ── 2. Fetch Customer ───────────────────────────────────────────
        const customer = await Customer.findById(customerId);
        if (!customer) {
            return res.status(404).json({ success: false, message: 'Customer nahi mila' });
        }

        // ── 3. Fetch Plan ───────────────────────────────────────────────
        const plan = await Plan.findById(planId);
        if (!plan) {
            return res.status(404).json({ success: false, message: 'Plan nahi mila' });
        }

        // ── 4. Calculate dates ──────────────────────────────────────────
        const start = startDate ? new Date(startDate) : new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + (plan.durationDays || 30));

        // ── 5. Find linked User (app login) via contactPhone ────────────
        let linkedUser = null;
        if (customer.contactPhone) {
            linkedUser = await User.findOne({ phone: customer.contactPhone });
        }
        if (!linkedUser && customer.email) {
            linkedUser = await User.findOne({ email: customer.email });
        }
        if (!linkedUser && customer.createdBy) {
            // Try createdBy reference (admin-created user link)
            linkedUser = await User.findById(customer.createdBy).catch(() => null);
        }

        // ── 6. Mark previous active subscription as Expired (Override) ──
        const prevSubQuery = {};
        if (linkedUser) prevSubQuery.$or = [
            { user: linkedUser._id, status: 'Active' },
            { customer: customerId, status: 'Active' }
        ];
        else prevSubQuery.$or = [{ customer: customerId, status: 'Active' }];

        await SubscriptionHistory.updateMany(prevSubQuery, { $set: { status: 'Expired' } });

        // ── 7. Update linked User's plan fields ─────────────────────────
        if (linkedUser) {
            await User.findByIdAndUpdate(linkedUser._id, {
                activePlan: plan._id,
                planExpiryDate: end,
                currentJobPostLimit: plan.jobPostLimit || 0,
                currentHiringLimit: plan.hiringLimit || 0,
                jobsPostedInCurrentPlan: 0,
                cooksHiredInCurrentPlan: 0
            });
        }

        // ── 8. Generate a manual reference ID ──────────────────────────
        const manualRef = paymentReference ||
            `MANUAL-${Date.now().toString(36).toUpperCase()}`;

        // ── 9. Create SubscriptionHistory record ────────────────────────
        const activatedByModel = req.admin.constructor.modelName; // 'Admin' or 'User'
        const subscription = await SubscriptionHistory.create({
            user: linkedUser ? linkedUser._id : undefined,
            customer: customerId,
            plan: plan._id,
            amountPaid: Number(amountPaid),
            startDate: start,
            endDate: end,
            status: 'Active',
            gateway: paymentMethod,
            orderId: manualRef,
            paymentMethod,
            paymentReference: paymentReference || '',
            paymentNote: paymentNote || '',
            activatedBy: req.admin._id,
            activatedByModel,
            activationType: 'manual'
        });

        // ── 10. Create Transaction record ────────────────────────────────
        await Transaction.create({
            user: linkedUser ? linkedUser._id : undefined,
            customer: customerId,
            type: 'subscription',
            amount: Number(amountPaid),
            status: 'success',
            gateway: paymentMethod,
            orderId: manualRef,
            relatedPlan: plan._id,
            description: `Admin activated by: ${req.admin.name || 'Admin'} | Method: ${paymentMethod}${paymentNote ? ' | Note: ' + paymentNote : ''}`
        });

        // ── 11. Populate and respond ─────────────────────────────────────
        const populatedSub = await SubscriptionHistory.findById(subscription._id)
            .populate('plan', 'name price durationDays jobPostLimit hiringLimit replacementLimit')
            .populate('activatedBy', 'name email');

        res.status(200).json({
            success: true,
            message: `✅ Plan "${plan.name}" successfully activated for ${customer.name}!`,
            subscription: populatedSub,
            linkedUser: linkedUser ? { _id: linkedUser._id, name: linkedUser.name, phone: linkedUser.phone } : null,
            startDate: start,
            endDate: end,
            daysValid: plan.durationDays
        });

    } catch (error) {
        console.error('adminActivatePlan error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
