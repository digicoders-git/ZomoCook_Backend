const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const User = require('../models/User');

router.get('/', protect, async (req, res) => {
    try {
        const user = await User.findById(req.admin._id).populate('activePlan');
        const subs = [];
        if (user.activePlan) {
            const plan = user.activePlan;
            const now = new Date();
            const expiry = new Date(user.planExpiryDate);
            const remainingTime = expiry.getTime() - now.getTime();
            const remainingDays = Math.ceil(remainingTime / (1000 * 3600 * 24));
            
            const Job = require('../models/Job');
            const Application = require('../models/Application');
            const userJobs = await Job.find({ createdBy: req.admin._id });
            const jobIds = userJobs.map(j => j._id);
            const apps = await Application.find({ job: { $in: jobIds } });

            const appliedCount = apps.filter(app => ['Applied', 'Profile Reviewed'].includes(app.status)).length;
            const shortlistedCount = apps.filter(app => ['Shortlisted', 'Demo Scheduled', 'Demo In Progress', 'Demo Completed', 'Reschedule Requested', 'On Hold'].includes(app.status)).length;
            const selectedCount = apps.filter(app => ['Package Selected', 'Package Paid'].includes(app.status) || (app.status === 'Hired' && app.offerStatus !== 'accepted')).length;
            const hiredCount = apps.filter(app => ['Offer Accepted', 'Joined'].includes(app.status) || (app.status === 'Hired' && app.offerStatus === 'accepted') || app.offerStatus === 'accepted').length;
            const rejectedCount = apps.filter(app => ['Rejected', 'Not Interested', 'Cancelled', 'Demo Cancelled', 'Offer Rejected', 'Rejected by Cook'].includes(app.status) || app.offerStatus === 'rejected').length;

            subs.push({
                id: plan._id,
                package_name: plan.name,
                price: plan.price,
                status: remainingDays > 0 ? 'active' : 'expired',
                total_days: plan.durationDays,
                remaining_days: remainingDays > 0 ? remainingDays : 0,
                staff_name: '',
                staff_role: '',
                joining_date: new Date(expiry.getTime() - (plan.durationDays * 24 * 3600 * 1000)).toISOString(),
                replacement_left: user.currentHiringLimit - user.cooksHiredInCurrentPlan,
                total_paid: plan.price,
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
        res.status(500).json({ success: false, message: e.message });
    }
});

module.exports = router;
