const Application = require('../models/Application');
const Candidate = require('../models/Candidate');
const User = require('../models/User');

/**
 * @desc    Get cook earnings (self or by candidateId)
 * @route   GET /api/earnings
 * @access  Private / Public with query
 */
const getCookEarnings = async (req, res) => {
    try {
        let candidateId = req.query.cookId || req.query.candidateId;
        
        // If 'self' or not passed, resolve from logged in user
        if ((!candidateId || candidateId === 'self') && req.user) {
            // Find candidate by user._id or phone
            const candidate = await Candidate.findOne({
                $or: [
                    { createdBy: req.user._id },
                    { phone: req.user.phone },
                    { email: req.user.email }
                ]
            });
            if (candidate) {
                candidateId = candidate._id;
            }
        }

        if (!candidateId || candidateId === 'self') {
            return res.status(200).json({
                success: true,
                totalEarnings: 0,
                pendingEarnings: 0,
                withdrawnEarnings: 0,
                earningsList: [],
                message: 'No earnings recorded'
            });
        }

        // Find applications where candidate is Hired
        const hiredApps = await Application.find({
            candidate: candidateId,
            status: { $in: ['Hired', 'Offer Accepted', 'Joined'] }
        }).populate('job').sort({ updatedAt: -1 });

        let totalEarnings = 0;
        const earningsList = hiredApps.map(app => {
            // If job specifies salary/rate
            let amount = 0;
            if (app.job) {
                const salaryStr = app.job.salary || app.job.expectedSalary || '0';
                const parsed = parseInt(salaryStr.replace(/[^0-9]/g, ''), 10);
                amount = isNaN(parsed) ? 0 : parsed;
            }
            totalEarnings += amount;
            return {
                id: app._id,
                title: app.job?.title || 'Hired Job',
                jobCategory: app.job?.jobCategory || 'Domestic',
                date: app.updatedAt || app.createdAt,
                amount: `₹${amount.toLocaleString('en-IN')}`,
                rawAmount: amount,
                status: 'Completed'
            };
        });

        res.status(200).json({
            success: true,
            totalEarnings,
            pendingEarnings: 0,
            withdrawnEarnings: 0,
            earningsList,
            count: earningsList.length
        });
    } catch (error) {
        console.error('Error fetching cook earnings:', error);
        res.status(500).json({ success: false, message: error.message, totalEarnings: 0, earningsList: [] });
    }
};

module.exports = {
    getCookEarnings
};
