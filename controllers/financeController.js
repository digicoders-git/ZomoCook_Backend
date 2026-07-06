const Transaction = require('../models/Transaction');
const SubscriptionHistory = require('../models/SubscriptionHistory');
const ServicePackagePayment = require('../models/ServicePackagePayment');

/**
 * @desc    Get Finance and Revenue stats
 * @route   GET /api/finance
 * @access  Private
 */
const getFinanceStats = async (req, res) => {
    try {
        const { date, period, manager } = req.query;
        // In a real scenario, you'd filter by manager if data supports it.
        // We will apply the date and period filters.

        const matchTx = { status: 'success' };
        const matchSp = { status: 'paid' };
        const matchSub = {};

        let startDate, endDate;
        if (date) {
            startDate = new Date(date);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(date);
            endDate.setHours(23, 59, 59, 999);
        } else if (period) {
            const now = new Date();
            if (period === 'today') {
                startDate = new Date();
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date();
                endDate.setHours(23, 59, 59, 999);
            } else if (period === 'this_week') {
                startDate = new Date();
                const day = startDate.getDay() || 7; 
                startDate.setDate(startDate.getDate() - (day - 1));
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date();
            } else if (period === 'this_month') {
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = new Date();
            } else if (period === 'this_year') {
                startDate = new Date(now.getFullYear(), 0, 1);
                endDate = new Date();
            }
        }

        if (startDate && endDate) {
            matchTx.createdAt = { $gte: startDate, $lte: endDate };
            matchSp.createdAt = { $gte: startDate, $lte: endDate };
            matchSub.createdAt = { $gte: startDate, $lte: endDate };
        }

        // 1. Total Revenue calculations
        const txAgg = await Transaction.aggregate([
            { $match: matchTx },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);
        const txRevenue = txAgg.length > 0 ? txAgg[0].total : 0;

        const subAgg = await SubscriptionHistory.aggregate([
            { $match: matchSub },
            { $group: { _id: null, total: { $sum: "$amountPaid" } } }
        ]);
        const subRevenue = subAgg.length > 0 ? subAgg[0].total : 0;

        const spAgg = await ServicePackagePayment.aggregate([
            { $match: matchSp },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);
        const spRevenue = spAgg.length > 0 ? spAgg[0].total : 0;

        const totalRevenue = txRevenue + subRevenue + spRevenue;

        // 2. Hiring Processing Fee (job post fees + daily advances)
        const hiringFeeAgg = await Transaction.aggregate([
            { $match: { ...matchTx, type: { $in: ['job_post_fee', 'daily_job_advance'] } } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);
        const hiringFee = hiringFeeAgg.length > 0 ? hiringFeeAgg[0].total : 0;

        // 3. Activated Packages (sum of service packages)
        const activatedPackages = spRevenue;

        // 4. Total Transactions Count
        const txCount = await Transaction.countDocuments(matchTx);
        const subCount = await SubscriptionHistory.countDocuments(matchSub);
        const spCount = await ServicePackagePayment.countDocuments(matchSp);
        const totalTxCount = txCount + subCount + spCount;

        // 5. Package Type breakdown for Donut Chart
        const packageBreakdown = await ServicePackagePayment.aggregate([
            { $match: matchSp },
            { $group: { _id: "$packageType", total: { $sum: "$amount" } } }
        ]);
        const packageSeriesMap = { Basic: 0, Standard: 0, Premium: 0, Others: 0 };
        packageBreakdown.forEach(p => {
            if (packageSeriesMap[p._id] !== undefined) {
                packageSeriesMap[p._id] = p.total;
            } else {
                packageSeriesMap.Others += p.total;
            }
        });
        const packageSeries = [packageSeriesMap.Basic, packageSeriesMap.Standard, packageSeriesMap.Premium, packageSeriesMap.Others];

        // 6. Lead Manager breakdown
        // Currently, transactions aren't directly linked to a manager in the schema, 
        // so we will show 'Direct App' as 100% of revenue for now.
        const managerSeries = [totalRevenue, 0, 0, 0, 0];
        
        // 7. Monthly Trends (Last 6 months)
        const months = [];
        const txMonthly = [0, 0, 0, 0, 0, 0];
        const spMonthly = [0, 0, 0, 0, 0, 0];
        const totalMonthly = [0, 0, 0, 0, 0, 0];

        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
        sixMonthsAgo.setDate(1); // Start of the 6th month ago
        sixMonthsAgo.setHours(0, 0, 0, 0);

        for (let i = 5; i >= 0; i--) {
            const dateStr = new Date();
            dateStr.setMonth(dateStr.getMonth() - i);
            months.push(dateStr.toLocaleString('default', { month: 'short', year: 'numeric' }));
        }

        // Helper to map month/year to array index
        const getMonthIndex = (month, year) => {
            for (let i = 0; i < 6; i++) {
                const d = new Date();
                d.setMonth(d.getMonth() - (5 - i));
                if (d.getMonth() + 1 === month && d.getFullYear() === year) return i;
            }
            return -1;
        };

        const realTxAgg = await Transaction.aggregate([
            { $match: { ...matchTx, createdAt: { $gte: sixMonthsAgo } } },
            { $group: { _id: { month: { $month: "$createdAt" }, year: { $year: "$createdAt" }, type: "$type" }, total: { $sum: "$amount" } } }
        ]);

        const realSpAgg = await ServicePackagePayment.aggregate([
            { $match: { ...matchSp, createdAt: { $gte: sixMonthsAgo } } },
            { $group: { _id: { month: { $month: "$createdAt" }, year: { $year: "$createdAt" } }, total: { $sum: "$amount" } } }
        ]);

        const realSubAgg = await SubscriptionHistory.aggregate([
            { $match: { createdAt: { $gte: sixMonthsAgo } } },
            { $group: { _id: { month: { $month: "$createdAt" }, year: { $year: "$createdAt" } }, total: { $sum: "$amountPaid" } } }
        ]);

        realTxAgg.forEach(item => {
            const idx = getMonthIndex(item._id.month, item._id.year);
            if (idx !== -1) {
                if (item._id.type === 'job_post_fee' || item._id.type === 'daily_job_advance') {
                    txMonthly[idx] += item.total;
                }
                totalMonthly[idx] += item.total;
            }
        });

        realSpAgg.forEach(item => {
            const idx = getMonthIndex(item._id.month, item._id.year);
            if (idx !== -1) {
                spMonthly[idx] += item.total;
                totalMonthly[idx] += item.total;
            }
        });

        realSubAgg.forEach(item => {
            const idx = getMonthIndex(item._id.month, item._id.year);
            if (idx !== -1) {
                totalMonthly[idx] += item.total;
            }
        });

        // 8. Recent Transactions Table Data
        // We'll fetch the latest 10 from each, combine and sort.
        const recentTx = await Transaction.find(matchTx).sort({ createdAt: -1 }).limit(10).populate('customer', 'name phone').populate('user', 'name phone');
        const recentSp = await ServicePackagePayment.find(matchSp).sort({ createdAt: -1 }).limit(10).populate('customer', 'name phone').populate('user', 'name phone');
        const recentSub = await SubscriptionHistory.find(matchSub).sort({ createdAt: -1 }).limit(10).populate('customer', 'name phone').populate('user', 'name phone');
        
        let allTransactions = [];

        recentTx.forEach(t => {
            const client = t.customer || t.user || {};
            allTransactions.push({
                date: t.createdAt,
                id: t.razorpayOrderId || t._id.toString().slice(-8).toUpperCase(),
                customer: client.name || 'Unknown',
                phone: client.phone || '-',
                type: t.type === 'job_post_fee' ? 'Job Post Fee' : t.type === 'daily_job_advance' ? 'Daily Job Advance' : 'Subscription',
                desc: t.description || (t.type === 'job_post_fee' ? 'Job post fee' : 'Transaction'),
                package: '-',
                manager: 'Unassigned', // Placeholder
                amount: t.amount,
                status: t.status === 'success' ? 'Paid' : t.status
            });
        });

        recentSp.forEach(s => {
            const client = s.customer || s.user || {};
            allTransactions.push({
                date: s.createdAt,
                id: s.razorpayOrderId || s._id.toString().slice(-8).toUpperCase(),
                customer: client.name || 'Unknown',
                phone: client.phone || '-',
                type: 'Activated Package',
                desc: `${s.packageType || 'Service'} Package`,
                package: s.packageType || 'Custom',
                manager: 'Unassigned', // Placeholder
                amount: s.amount,
                status: s.status === 'paid' ? 'Paid' : s.status
            });
        });

        recentSub.forEach(s => {
            const client = s.customer || s.user || {};
            allTransactions.push({
                date: s.createdAt,
                id: s.razorpayOrderId || s._id.toString().slice(-8).toUpperCase(),
                customer: client.name || 'Unknown',
                phone: client.phone || '-',
                type: 'Subscription',
                desc: 'Subscription purchase',
                package: '-',
                manager: 'Unassigned', // Placeholder
                amount: s.amountPaid,
                status: s.status === 'Active' || s.status === 'Expired' ? 'Paid' : s.status
            });
        });

        allTransactions.sort((a, b) => b.date - a.date);
        const topTransactions = allTransactions.slice(0, 10).map(t => ({
            ...t,
            date: t.date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
        }));

        res.json({
            success: true,
            stats: {
                totalRevenue,
                hiringFee,
                activatedPackages,
                totalTxCount
            },
            charts: {
                lineChart: {
                    categories: months,
                    series: [
                        { name: 'Total Revenue', data: totalMonthly },
                        { name: 'Hiring Processing Fee', data: txMonthly },
                        { name: 'Activated Packages', data: spMonthly }
                    ]
                },
                packageSeries,
                managerSeries
            },
            recentTransactions: topTransactions
        });

    } catch (error) {
        console.error('Finance Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getFinanceStats
};
