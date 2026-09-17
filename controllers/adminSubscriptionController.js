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
 * @desc    Admin / Lead Manager directly activates a plan for a customer (with partial/full payment support)
 * @route   POST /api/admin/activate-plan
 * @access  Private (Admin / Lead Manager)
 */
exports.adminActivatePlan = async (req, res) => {
    try {
        const {
            customerId,
            planId,
            totalAmount,
            amountPaid,
            paymentMethod = 'cash',
            paymentReference = '',
            paymentNote = '',
            startDate,
            overridePrevious = false, // Default false to keep multiple active packages
            customJobPostLimit,
            customHiringLimit,
            customReplacementLimit
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

        // Calculate package total & due amount
        const finalTotal = totalAmount !== undefined && totalAmount !== null && totalAmount !== '' 
            ? Number(totalAmount) 
            : Number(plan.price || 0);
        const finalPaid = Number(amountPaid);
        const finalDue = Math.max(0, finalTotal - finalPaid);
        const paymentStatus = finalDue === 0 ? 'paid' : (finalPaid > 0 ? 'partial' : 'pending');

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
            linkedUser = await User.findById(customer.createdBy).catch(() => null);
        }

        // ── 6. Handle previous subscriptions ──
        if (overridePrevious) {
            const prevSubQuery = {};
            if (linkedUser) prevSubQuery.$or = [
                { user: linkedUser._id, status: 'Active' },
                { customer: customerId, status: 'Active' }
            ];
            else prevSubQuery.$or = [{ customer: customerId, status: 'Active' }];

            await SubscriptionHistory.updateMany(prevSubQuery, { $set: { status: 'Expired' } });
        }

        // ── 7. Update linked User's plan fields (Cumulative limits support) ─────────────────────────
        const jobLimitToAdd = customJobPostLimit !== undefined && customJobPostLimit !== '' 
            ? Number(customJobPostLimit) 
            : Number(plan.jobPostLimit || 0);
        const hiringLimitToAdd = customHiringLimit !== undefined && customHiringLimit !== '' 
            ? Number(customHiringLimit) 
            : Number(plan.hiringLimit || 0);

        if (linkedUser) {
            // Keep latest expiry date (whichever is further out)
            let newExpiry = end;
            if (!overridePrevious && linkedUser.planExpiryDate && new Date(linkedUser.planExpiryDate) > end) {
                newExpiry = linkedUser.planExpiryDate;
            }

            const currentJobLimit = overridePrevious ? 0 : (linkedUser.currentJobPostLimit || 0);
            const currentHiringLimit = overridePrevious ? 0 : (linkedUser.currentHiringLimit || 0);
            const currentJobsPosted = overridePrevious ? 0 : (linkedUser.jobsPostedInCurrentPlan || 0);
            const currentCooksHired = overridePrevious ? 0 : (linkedUser.cooksHiredInCurrentPlan || 0);

            await User.findByIdAndUpdate(linkedUser._id, {
                activePlan: plan._id,
                planExpiryDate: newExpiry,
                currentJobPostLimit: currentJobLimit + jobLimitToAdd,
                currentHiringLimit: currentHiringLimit + hiringLimitToAdd,
                jobsPostedInCurrentPlan: currentJobsPosted,
                cooksHiredInCurrentPlan: currentCooksHired
            });
        }

        // ── 8. Generate a manual reference ID ──────────────────────────
        const manualRef = paymentReference ||
            `MANUAL-${Date.now().toString(36).toUpperCase()}`;

        // ── 9. Create SubscriptionHistory record ────────────────────────
        const activatedByModel = req.admin.constructor.modelName || 'Admin';
        const actorName = req.admin.name || 'Admin / Manager';

        const paymentRecord = {
            amount: finalPaid,
            paymentMethod,
            paymentReference: paymentReference || '',
            paymentNote: paymentNote || 'Initial payment at activation',
            collectedBy: req.admin._id,
            collectedByModel: activatedByModel,
            collectedByName: actorName,
            collectedAt: new Date()
        };

        const subscription = await SubscriptionHistory.create({
            user: linkedUser ? linkedUser._id : undefined,
            customer: customerId,
            plan: plan._id,
            totalAmount: finalTotal,
            amountPaid: finalPaid,
            dueAmount: finalDue,
            paymentStatus,
            customJobPostLimit: jobLimitToAdd,
            customHiringLimit: hiringLimitToAdd,
            customReplacementLimit: customReplacementLimit ? Number(customReplacementLimit) : plan.replacementLimit,
            paymentHistory: finalPaid > 0 ? [paymentRecord] : [],
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
        if (finalPaid > 0) {
            await Transaction.create({
                user: linkedUser ? linkedUser._id : undefined,
                customer: customerId,
                type: 'subscription',
                amount: finalPaid,
                status: 'success',
                gateway: paymentMethod,
                orderId: manualRef,
                relatedPlan: plan._id,
                description: `Activated by: ${actorName} | Method: ${paymentMethod} | Total: ₹${finalTotal}, Paid: ₹${finalPaid}, Due: ₹${finalDue}${paymentNote ? ' | Note: ' + paymentNote : ''}`
            });
        }

        // ── 11. Populate and respond ─────────────────────────────────────
        const populatedSub = await SubscriptionHistory.findById(subscription._id)
            .populate('plan', 'name price durationDays jobPostLimit hiringLimit replacementLimit isCustom')
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

/**
 * @desc    Admin / Lead Manager updates an existing package / collects remaining payment / modifies limits
 * @route   PUT /api/admin/subscriptions/:id/update
 * @access  Private (Admin / Lead Manager)
 */
exports.updateSubscriptionPackage = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            // New payment collection
            newPaymentAmount,
            paymentMethod = 'cash',
            paymentReference = '',
            paymentNote = '',
            
            // Direct field updates
            totalAmount,
            dueAmount,
            endDate,
            status,
            customJobPostLimit,
            customHiringLimit,
            customReplacementLimit
        } = req.body;

        const sub = await SubscriptionHistory.findById(id).populate('plan');
        if (!sub) {
            return res.status(404).json({ success: false, message: 'Subscription record nahi mila' });
        }

        const actorName = req.admin.name || 'Admin / Manager';
        const activatedByModel = req.admin.constructor.modelName || 'Admin';

        // 1. If a new payment is collected
        if (newPaymentAmount && Number(newPaymentAmount) > 0) {
            const addedAmount = Number(newPaymentAmount);
            sub.amountPaid = (sub.amountPaid || 0) + addedAmount;
            
            const currentTotal = totalAmount !== undefined ? Number(totalAmount) : (sub.totalAmount || sub.plan?.price || sub.amountPaid);
            sub.totalAmount = currentTotal;
            sub.dueAmount = Math.max(0, currentTotal - sub.amountPaid);
            sub.paymentStatus = sub.dueAmount === 0 ? 'paid' : 'partial';

            sub.paymentHistory.push({
                amount: addedAmount,
                paymentMethod,
                paymentReference: paymentReference || '',
                paymentNote: paymentNote || 'Subsequent payment collected',
                collectedBy: req.admin._id,
                collectedByModel: activatedByModel,
                collectedByName: actorName,
                collectedAt: new Date()
            });

            // Create Transaction record
            const manualRef = paymentReference || `PAY-${Date.now().toString(36).toUpperCase()}`;
            await Transaction.create({
                user: sub.user,
                customer: sub.customer,
                type: 'subscription',
                amount: addedAmount,
                status: 'success',
                gateway: paymentMethod,
                orderId: manualRef,
                relatedPlan: sub.plan?._id,
                description: `Payment collected by: ${actorName} | Method: ${paymentMethod} | Amount: ₹${addedAmount} (Remaining Due: ₹${sub.dueAmount})${paymentNote ? ' | Note: ' + paymentNote : ''}`
            });
        } else {
            // Direct manual update of amounts if provided
            if (totalAmount !== undefined && totalAmount !== null) {
                sub.totalAmount = Number(totalAmount);
                if (dueAmount !== undefined && dueAmount !== null) {
                    sub.dueAmount = Number(dueAmount);
                    sub.amountPaid = Math.max(0, sub.totalAmount - sub.dueAmount);
                } else {
                    sub.dueAmount = Math.max(0, sub.totalAmount - (sub.amountPaid || 0));
                }
                sub.paymentStatus = sub.dueAmount === 0 ? 'paid' : (sub.amountPaid > 0 ? 'partial' : 'pending');
            } else if (dueAmount !== undefined && dueAmount !== null) {
                sub.dueAmount = Number(dueAmount);
                sub.paymentStatus = sub.dueAmount === 0 ? 'paid' : 'partial';
            }
        }

        // 2. Direct field updates
        if (endDate) sub.endDate = new Date(endDate);
        if (status) sub.status = status;
        if (customJobPostLimit !== undefined) sub.customJobPostLimit = Number(customJobPostLimit);
        if (customHiringLimit !== undefined) sub.customHiringLimit = Number(customHiringLimit);
        if (customReplacementLimit !== undefined) sub.customReplacementLimit = Number(customReplacementLimit);

        await sub.save();

        // 3. Update linked user limits if hiringLimit or jobLimit changed
        if (sub.user) {
            const user = await User.findById(sub.user);
            if (user) {
                if (endDate && new Date(endDate) > new Date(user.planExpiryDate || 0)) {
                    user.planExpiryDate = new Date(endDate);
                }
                await user.save();
            }
        }

        const updatedSub = await SubscriptionHistory.findById(sub._id)
            .populate('plan', 'name price durationDays jobPostLimit hiringLimit replacementLimit isCustom')
            .populate('activatedBy', 'name email');

        res.status(200).json({
            success: true,
            message: '✅ Package / Payment details updated successfully!',
            subscription: updatedSub
        });

    } catch (error) {
        console.error('updateSubscriptionPackage error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
