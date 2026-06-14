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
                total_paid: plan.price
            });
        }
        res.status(200).json({ success: true, subscriptions: subs });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

module.exports = router;
