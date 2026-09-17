const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const User = require('../models/User');

router.get('/', protect, async (req, res) => {
    try {
        const userId = req.admin._id;
        const SubscriptionHistory = require('../models/SubscriptionHistory');
        const Customer = require('../models/Customer');
        const Job = require('../models/Job');
        const Application = require('../models/Application');

        // Find customer linked to this user (phone or email or createdBy)
        const user = await User.findById(userId).populate('activePlan');
        let customer = null;
        if (user) {
            if (user.phone) customer = await Customer.findOne({ contactPhone: user.phone });
            if (!customer && user.email) customer = await Customer.findOne({ email: user.email });
        }

        const userIds = [userId];
        if (customer) userIds.push(customer._id);

        const subHistories = await SubscriptionHistory.find({
            $or: [
                { user: { $in: userIds } },
                { customer: { $in: userIds } }
            ]
        }).populate('plan').sort({ createdAt: -1 });

        const userJobs = await Job.find({ 
            $or: [
                { createdBy: userId },
                ...(customer ? [{ customer: customer._id }, { customer: userId }] : [])
            ]
        });
        const jobIds = userJobs.map(j => j._id);
        const apps = await Application.find({ job: { $in: jobIds } });

        const appliedCount = apps.filter(app => ['Applied', 'Profile Reviewed'].includes(app.status)).length;
        const shortlistedCount = apps.filter(app => ['Shortlisted', 'Demo Scheduled', 'Demo In Progress', 'Demo Completed', 'Reschedule Requested', 'On Hold'].includes(app.status)).length;
        const selectedCount = apps.filter(app => ['Package Selected', 'Package Paid'].includes(app.status) || (app.status === 'Hired' && app.offerStatus !== 'accepted')).length;
        const hiredCount = apps.filter(app => ['Offer Accepted', 'Joined'].includes(app.status) || (app.status === 'Hired' && app.offerStatus === 'accepted') || app.offerStatus === 'accepted').length;
        const rejectedCount = apps.filter(app => ['Rejected', 'Not Interested', 'Cancelled', 'Demo Cancelled', 'Offer Rejected', 'Rejected by Cook'].includes(app.status) || app.offerStatus === 'rejected').length;

        const now = new Date();
        const subs = [];

        if (subHistories && subHistories.length > 0) {
            subHistories.forEach(sub => {
                const plan = sub.plan || {};
                const expiry = new Date(sub.endDate);
                const remainingTime = expiry.getTime() - now.getTime();
                const remainingDays = Math.ceil(remainingTime / (1000 * 3600 * 24));
                const isActuallyActive = sub.status === 'Active' && remainingDays > 0;

                const totalVal = sub.totalAmount !== undefined && sub.totalAmount !== null 
                    ? sub.totalAmount 
                    : (plan.price || sub.amountPaid || 0);
                const paidVal = sub.amountPaid !== undefined && sub.amountPaid !== null 
                    ? sub.amountPaid 
                    : 0;
                const dueVal = sub.dueAmount !== undefined && sub.dueAmount !== null 
                    ? sub.dueAmount 
                    : Math.max(0, totalVal - paidVal);

                subs.push({
                    id: sub._id.toString(),
                    plan_id: plan._id ? plan._id.toString() : '',
                    package_name: plan.name || 'Custom Package',
                    price: totalVal,
                    total_amount: totalVal,
                    total_paid: paidVal,
                    amount_paid: paidVal,
                    due_amount: dueVal,
                    payment_status: sub.paymentStatus || (dueVal === 0 ? 'paid' : 'partial'),
                    status: isActuallyActive ? 'active' : 'expired',
                    total_days: plan.durationDays || Math.ceil((new Date(sub.endDate) - new Date(sub.startDate)) / (1000 * 3600 * 24)) || 30,
                    remaining_days: isActuallyActive ? remainingDays : 0,
                    start_date: sub.startDate,
                    end_date: sub.endDate,
                    joining_date: sub.startDate ? new Date(sub.startDate).toISOString() : new Date().toISOString(),
                    replacement_left: sub.customReplacementLimit !== undefined ? sub.customReplacementLimit : (plan.replacementLimit || 0),
                    hiring_limit: sub.customHiringLimit !== undefined ? sub.customHiringLimit : (plan.hiringLimit || 0),
                    job_post_limit: sub.customJobPostLimit !== undefined ? sub.customJobPostLimit : (plan.jobPostLimit || 0),
                    staff_name: '',
                    staff_role: '',
                    applied_count: appliedCount,
                    shortlisted_count: shortlistedCount,
                    selected_count: selectedCount,
                    hired_count: hiredCount,
                    rejected_count: rejectedCount,
                });
            });
        } else if (user && user.activePlan) {
            // Fallback for direct user activePlan reference
            const plan = user.activePlan;
            const expiry = new Date(user.planExpiryDate);
            const remainingTime = expiry.getTime() - now.getTime();
            const remainingDays = Math.ceil(remainingTime / (1000 * 3600 * 24));
            
            subs.push({
                id: plan._id.toString(),
                package_name: plan.name,
                price: plan.price,
                total_amount: plan.price,
                total_paid: plan.price,
                amount_paid: plan.price,
                due_amount: 0,
                payment_status: 'paid',
                status: remainingDays > 0 ? 'active' : 'expired',
                total_days: plan.durationDays,
                remaining_days: remainingDays > 0 ? remainingDays : 0,
                joining_date: new Date(expiry.getTime() - (plan.durationDays * 24 * 3600 * 1000)).toISOString(),
                replacement_left: user.currentHiringLimit - user.cooksHiredInCurrentPlan,
                applied_count: appliedCount,
                shortlisted_count: shortlistedCount,
                selected_count: selectedCount,
                hired_count: hiredCount,
                rejected_count: rejectedCount,
            });
        }

        let resultSubs = subs;
        if (req.query.status) {
            resultSubs = subs.filter(s => s.status === req.query.status);
        }
        res.status(200).json({ success: true, subscriptions: resultSubs });
    } catch (e) {
        console.error('Subscription query error:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

module.exports = router;
