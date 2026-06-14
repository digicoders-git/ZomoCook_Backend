const SubscriptionHistory = require('../models/SubscriptionHistory');

/**
 * @desc    Get all subscriptions with stats for admin tracking
 * @route   GET /api/admin/subscriptions
 * @access  Private (Admin)
 */
exports.getAllSubscriptions = async (req, res) => {
    try {
        const subscriptions = await SubscriptionHistory.find()
            .populate('user', 'name email phone status profilePic')
            .populate('plan', 'name price durationDays jobPostLimit hiringLimit')
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
                // Note: Not saving to DB here to avoid slow response, but for production 
                // a cron job or save() should be used.
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
