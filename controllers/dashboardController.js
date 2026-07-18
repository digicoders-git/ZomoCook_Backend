const Job = require('../models/Job');
const Candidate = require('../models/Candidate');
const Customer = require('../models/Customer');
const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const SubscriptionHistory = require('../models/SubscriptionHistory');
const ServicePackagePayment = require('../models/ServicePackagePayment');
const Application = require('../models/Application');

/**
 * @desc    Get dashboard statistics with filters
 * @route   GET /api/dashboard
 * @access  Private
 */
const getDashboardStats = async (req, res) => {
    try {
        const { category, customer, position, date } = req.query;

        const isSuperAdmin = req.admin.constructor.modelName === 'Admin';
        const isManager = req.admin.role && ['manager', 'super admin', 'admin'].includes(req.admin.role.name.toLowerCase());
        const isInternalStaff = isSuperAdmin || (
            req.admin.role && 
            !['cook', 'user', 'customer'].includes(req.admin.role.name.toLowerCase())
        );
        
        // Construct dynamic filter for Jobs
        const jobFilter = {};
        if (!isInternalStaff) {
            jobFilter.createdBy = req.admin._id;
        } else if (!isSuperAdmin && !isManager) {
            // Restricted staff user (like Lead Manager, Telecaller, etc.) — show their assigned jobs only
            const escapedName = req.admin.name ? req.admin.name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&').trim() : '';
            const escapedEmail = req.admin.email ? req.admin.email.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&').trim() : '';
            
            jobFilter.$or = [
                { leadManager: req.admin._id.toString() },
                { leadManager: new RegExp(`^\\s*${escapedName}\\s*$`, 'i') },
                { leadManager: new RegExp(`^\\s*${escapedEmail}\\s*$`, 'i') }
            ];
        }

        if (category) jobFilter.jobCategory = category;
        if (customer) jobFilter.customer = new mongoose.Types.ObjectId(customer);
        if (position) jobFilter.jobPosition = position;
        if (date) {
            let start, end;
            if (date === 'today') {
                start = new Date();
                start.setHours(0, 0, 0, 0);
                end = new Date();
                end.setHours(23, 59, 59, 999);
            } else if (date === 'yesterday') {
                start = new Date();
                start.setDate(start.getDate() - 1);
                start.setHours(0, 0, 0, 0);
                end = new Date();
                end.setDate(end.getDate() - 1);
                end.setHours(23, 59, 59, 999);
            } else {
                start = new Date(date);
                end = new Date(date);
                end.setDate(end.getDate() + 1);
            }
            jobFilter.createdAt = { $gte: start, $lt: end };
        }

        // Construct dynamic filter for Candidates/Applications
        const appMatchFilter = {};
        let candidateQuery = {};
        let customerQuery = {};

        if (!isInternalStaff) {
            appMatchFilter.createdBy = req.admin._id;
            candidateQuery.createdBy = req.admin._id;
            customerQuery.createdBy = req.admin._id;
        } else if (!isSuperAdmin && !isManager) {
            // Staff user (Lead Manager, Telecaller, etc.) — show applications for their assigned jobs only
            const escapedName = req.admin.name ? req.admin.name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&').trim() : '';
            const escapedEmail = req.admin.email ? req.admin.email.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&').trim() : '';
            
            const assignedJobs = await Job.find({
                $or: [
                    { leadManager: req.admin._id.toString() },
                    { leadManager: new RegExp(`^\\s*${escapedName}\\s*$`, 'i') },
                    { leadManager: new RegExp(`^\\s*${escapedEmail}\\s*$`, 'i') }
                ]
            }).select('_id customer');
            
            const assignedJobIds = assignedJobs.map(j => j._id);
            const customerIds = [...new Set(assignedJobs.map(j => j.customer?.toString()).filter(Boolean))];
            
            const assignedApps = await Application.find({ job: { $in: assignedJobIds } }).select('candidate');
            const candidateIds = [...new Set(assignedApps.map(a => a.candidate?.toString()).filter(Boolean))];
            
            appMatchFilter["applications.job"] = { $in: assignedJobIds };
            candidateQuery._id = { $in: candidateIds };
            customerQuery._id = { $in: customerIds };
        }

        if (category) appMatchFilter["jobInfo.jobCategory"] = category;
        if (customer) appMatchFilter["jobInfo.customer"] = new mongoose.Types.ObjectId(customer);
        if (position) appMatchFilter["jobInfo.jobPosition"] = position;
        if (date) {
            let start, end;
            if (date === 'today') {
                start = new Date();
                start.setHours(0, 0, 0, 0);
                end = new Date();
                end.setHours(23, 59, 59, 999);
            } else if (date === 'yesterday') {
                start = new Date();
                start.setDate(start.getDate() - 1);
                start.setHours(0, 0, 0, 0);
                end = new Date();
                end.setDate(end.getDate() - 1);
                end.setHours(23, 59, 59, 999);
            } else {
                start = new Date(date);
                end = new Date(date);
                end.setDate(end.getDate() + 1);
            }
            appMatchFilter["applications.appliedDate"] = { $gte: start, $lt: end };
        }

        // 1. Basic Stats
        const totalJobs = await Job.countDocuments(jobFilter);
        const totalCandidates = await Candidate.countDocuments(candidateQuery);
        const totalCustomers = await Customer.countDocuments(customerQuery);
        const pendingCandidates = await Candidate.countDocuments({ 
            kycStatus: 'pending',
            ...candidateQuery
        });

        // 2. Application Status Counts
        const applicationStats = await Candidate.aggregate([
            { $match: candidateQuery },
            { $unwind: "$applications" },
            {
                $lookup: {
                    from: "jobs",
                    localField: "applications.job",
                    foreignField: "_id",
                    as: "jobInfo"
                }
            },
            { $unwind: "$jobInfo" },
            { $match: appMatchFilter },
            {
                $group: {
                    _id: "$applications.status",
                    count: { $sum: 1 }
                }
            }
        ]);

        const statsMap = {
            'Applied': 0,
            'Shortlisted': 0,
            'Demo Scheduled': 0,
            'Reschedule Requested': 0,
            'Hired': 0,
            'Rejected': 0,
            'On Hold': 0,
            'Not Interested': 0
        };

        applicationStats.forEach(stat => {
            if (statsMap.hasOwnProperty(stat._id)) {
                statsMap[stat._id] = stat.count;
            }
        });

        const totalApplications = Object.values(statsMap).reduce((a, b) => a + b, 0);

        // 3. Category Distribution (Jobs) - Week, Month, Year, and Global
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - 7);
        const categoryStatsWeek = await Job.aggregate([
            { $match: { ...jobFilter, createdAt: { $gte: weekStart } } },
            { $group: { _id: "$jobCategory", count: { $sum: 1 } } }
        ]);

        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0,0,0,0);
        const categoryStatsMonth = await Job.aggregate([
            { $match: { ...jobFilter, createdAt: { $gte: monthStart } } },
            { $group: { _id: "$jobCategory", count: { $sum: 1 } } }
        ]);

        const yearStart = new Date();
        yearStart.setMonth(0, 1);
        yearStart.setHours(0,0,0,0);
        const categoryStatsYear = await Job.aggregate([
            { $match: { ...jobFilter, createdAt: { $gte: yearStart } } },
            { $group: { _id: "$jobCategory", count: { $sum: 1 } } }
        ]);

        const categoryStatsAll = await Job.aggregate([
            { $match: jobFilter },
            { $group: { _id: "$jobCategory", count: { $sum: 1 } } }
        ]);

        const categoryStats = {
            week: categoryStatsWeek,
            month: categoryStatsMonth,
            year: categoryStatsYear,
            all: categoryStatsAll
        };

        // 4. Monthly Application Growth (Last 6 months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const growthStats = await Candidate.aggregate([
            { $match: candidateQuery },
            { $unwind: "$applications" },
            {
                $lookup: {
                    from: "jobs",
                    localField: "applications.job",
                    foreignField: "_id",
                    as: "jobInfo"
                }
            },
            { $unwind: "$jobInfo" },
            { 
                $match: { 
                    ...appMatchFilter,
                    "applications.appliedDate": { $gte: sixMonthsAgo } 
                } 
            },
            {
                $group: {
                    _id: {
                        month: { $month: "$applications.appliedDate" },
                        year: { $year: "$applications.appliedDate" }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } }
        ]);

        // 5. Position Distribution Table Data
        const positionStats = await Job.aggregate([
            { $match: jobFilter },
            {
                $group: {
                    _id: "$jobPosition",
                    jobCount: { $sum: 1 },
                    totalVacancy: { 
                        $sum: { 
                            $toInt: { 
                                $ifNull: [
                                    { $cond: [{ $eq: ["$jobCategory", "daily"] }, "$noOfGuests", "$packageOrGuestOrVacancy"] },
                                    "0"
                                ] 
                            } 
                        } 
                    }
                }
            },
            { $limit: 20 }
        ]);

        const appCountsPerPosition = await Candidate.aggregate([
            { $match: candidateQuery },
            { $unwind: "$applications" },
            {
                $lookup: {
                    from: "jobs",
                    localField: "applications.job",
                    foreignField: "_id",
                    as: "jobInfo"
                }
            },
            { $unwind: "$jobInfo" },
            { $match: appMatchFilter },
            {
                $group: {
                    _id: {
                        position: "$jobInfo.jobPosition",
                        status: "$applications.status"
                    },
                    count: { $sum: 1 }
                }
            }
        ]);

        const tableData = positionStats.map(pos => {
            const posApps = appCountsPerPosition.filter(a => a._id.position === pos._id);
            const getCount = (status) => posApps.find(a => a._id.status === status)?.count || 0;

            return {
                position: pos._id,
                jobs: pos.jobCount,
                vacancy: pos.totalVacancy || 0,
                applied: getCount('Applied'),
                assigned: getCount('Shortlisted'),
                demo: getCount('Demo Scheduled'),
                reschedule: getCount('Reschedule Requested'),
                rejected: getCount('Rejected'),
                onHold: getCount('On Hold'),
                notInterested: getCount('Not Interested'),
                hired: getCount('Hired')
            };
        });

        // ─── 6. Computed KPI Percentages ───────────────────────────────────────
        const successPercentage = totalApplications > 0
            ? Math.min(100, Math.round((statsMap['Hired'] / totalApplications) * 100))
            : 0;

        const medianRatio = totalApplications > 0
            ? Math.min(100, Math.round((statsMap['Shortlisted'] / totalApplications) * 100))
            : 0;

        const performanceScore = totalApplications > 0
            ? Math.min(100, Math.round(((statsMap['Hired'] + statsMap['Demo Scheduled']) / totalApplications) * 100))
            : 0;

        // ─── 7. Sparkline — Last 11 Days Daily Breakdown ──────────────────────
        const elevenDaysAgo = new Date();
        elevenDaysAgo.setDate(elevenDaysAgo.getDate() - 10);
        elevenDaysAgo.setHours(0, 0, 0, 0);

        // Helper: build array of last 11 date strings [YYYY-MM-DD]
        const last11Days = Array.from({ length: 11 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (10 - i));
            return d.toISOString().split('T')[0];
        });

        // Helper: map aggregation result to ordered 11-element array
        const fillDays = (aggResult) =>
            last11Days.map(day => {
                const found = aggResult.find(r => r._id === day);
                return found ? found.count : 0;
            });

        // Daily new candidates added
        const rawDailyCandidates = await Candidate.aggregate([
            { $match: { ...candidateQuery, createdAt: { $gte: elevenDaysAgo } } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    count: { $sum: 1 }
                }
            }
        ]);

        // Daily applications
        const rawDailyApplications = await Candidate.aggregate([
            { $match: candidateQuery },
            { $unwind: '$applications' },
            { $match: { 'applications.appliedDate': { $gte: elevenDaysAgo } } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$applications.appliedDate' } },
                    count: { $sum: 1 }
                }
            }
        ]);

        // Daily demo scheduled
        const rawDailyDemo = await Candidate.aggregate([
            { $match: candidateQuery },
            { $unwind: '$applications' },
            {
                $match: {
                    'applications.appliedDate': { $gte: elevenDaysAgo },
                    'applications.status': 'Demo Scheduled'
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$applications.appliedDate' } },
                    count: { $sum: 1 }
                }
            }
        ]);

        // Daily hired
        const rawDailyHired = await Candidate.aggregate([
            { $match: candidateQuery },
            { $unwind: '$applications' },
            {
                $match: {
                    'applications.appliedDate': { $gte: elevenDaysAgo },
                    'applications.status': 'Hired'
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$applications.appliedDate' } },
                    count: { $sum: 1 }
                }
            }
        ]);

        // ─── 8. Radar — Monthly Applications (Jan–Jun current year) ──────────
        const currentYear = new Date().getFullYear();
        const startOfYear = new Date(currentYear, 0, 1);

        const rawRadarStats = await Candidate.aggregate([
            { $match: candidateQuery },
            { $unwind: '$applications' },
            { $match: { 'applications.appliedDate': { $gte: startOfYear } } },
            {
                $group: {
                    _id: { month: { $month: '$applications.appliedDate' } },
                    count: { $sum: 1 }
                }
            }
        ]);

        // Jan(1) to Jun(6) — 6 slots
        const radarData = [1, 2, 3, 4, 5, 6].map(m => {
            const found = rawRadarStats.find(r => r._id.month === m);
            return found ? found.count : 0;
        });

        // --- Custom Dashboard Enhancements for Redesign ---
        
        // 1. Calculate total transactions sum (Revenue)
        const txAgg = await Transaction.aggregate([
            { $match: { status: 'success' } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);
        const txRevenue = txAgg.length > 0 ? txAgg[0].total : 0;

        const subAgg = await SubscriptionHistory.aggregate([
            { $group: { _id: null, total: { $sum: "$amountPaid" } } }
        ]);
        const subRevenue = subAgg.length > 0 ? subAgg[0].total : 0;

        const spAgg = await ServicePackagePayment.aggregate([
            { $match: { status: 'paid' } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);
        const spRevenue = spAgg.length > 0 ? spAgg[0].total : 0;

        const totalRevenue = txRevenue + subRevenue + spRevenue;

        // 2. Active Subscriptions count
        const activeSubscriptions = await SubscriptionHistory.countDocuments({ status: 'Active' });

        // 3. Recent Jobs (5)
        const recentJobsRaw = await Job.find(jobFilter)
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('customer', 'name');
        
        const recentJobs = await Promise.all(recentJobsRaw.map(async (j) => {
            const appCount = await Application.countDocuments({ job: j._id });
            return {
                _id: j._id,
                title: j.title || 'Untitled Job',
                jobCategory: j.jobCategory,
                jobType: j.jobType || 'Full Time',
                createdAt: j.createdAt.toISOString().split('T')[0],
                applicationsCount: appCount
            };
        }));

        // 4. Recent Trials / Demo (5)
        const recentTrialsRaw = await Candidate.aggregate([
            { $match: candidateQuery },
            { $unwind: "$applications" },
            { $match: { "applications.status": { $in: ['Demo Scheduled', 'Reschedule Requested'] } } },
            { $sort: { "applications.appliedDate": -1 } },
            { $limit: 5 },
            {
                $lookup: {
                    from: "jobs",
                    localField: "applications.job",
                    foreignField: "_id",
                    as: "jobInfo"
                }
            },
            { $unwind: { path: "$jobInfo", preserveNullAndEmptyArrays: true } }
        ]);
        const recentTrials = recentTrialsRaw.map(t => ({
            title: t.jobInfo?.title || 'Unknown Job',
            candidateName: t.name || 'Unknown Candidate',
            trialDate: t.applications.demoDate ? t.applications.demoDate.toISOString().split('T')[0] : (t.applications.appliedDate ? t.applications.appliedDate.toISOString().split('T')[0] : '-'),
            status: t.applications.status
        }));

        // 5. Latest Transactions (5)
        const recentTx = await Transaction.find({ status: 'success' })
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('customer', 'name');
        const recentSp = await ServicePackagePayment.find({ status: 'paid' })
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('customer', 'name');
        const recentSub = await SubscriptionHistory.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('customer', 'name');

        let allTx = [];
        recentTx.forEach(t => {
            allTx.push({
                invoiceNo: t.razorpayOrderId || t._id.toString().slice(-8).toUpperCase(),
                customer: t.customer?.name || 'Walk-in Customer',
                package: 'Job Post Fee',
                amount: t.amount,
                date: t.createdAt
            });
        });
        recentSp.forEach(s => {
            allTx.push({
                invoiceNo: s.razorpayOrderId || s._id.toString().slice(-8).toUpperCase(),
                customer: s.customer?.name || 'Walk-in Customer',
                package: `${s.packageType} Package`,
                amount: s.amount,
                date: s.createdAt
            });
        });
        recentSub.forEach(s => {
            allTx.push({
                invoiceNo: s.razorpayOrderId || s._id.toString().slice(-8).toUpperCase(),
                customer: s.customer?.name || 'Walk-in Customer',
                package: 'Subscription Plan',
                amount: s.amountPaid,
                date: s.createdAt
            });
        });
        allTx.sort((a, b) => b.date - a.date);
        const latestTransactions = allTx.slice(0, 5).map(tx => ({
            invoiceNo: tx.invoiceNo,
            customer: tx.customer,
            package: tx.package,
            amount: tx.amount,
            date: tx.date.toISOString().split('T')[0],
            status: 'Paid'
        }));

        // 6. Category Performance
        const categoriesList = ['hotel', 'home', 'daily'];
        const ApplicationModel = require('../models/Application');
        const categoryPerformance = await Promise.all(categoriesList.map(async (cat) => {
            const catJobFilter = { ...jobFilter, jobCategory: cat };
            const jobsCount = await Job.countDocuments(catJobFilter);

            const catAppFilter = { ...appMatchFilter, "jobInfo.jobCategory": cat };
            const appsAgg = await Candidate.aggregate([
                { $match: candidateQuery },
                { $unwind: "$applications" },
                {
                    $lookup: {
                        from: "jobs",
                        localField: "applications.job",
                        foreignField: "_id",
                        as: "jobInfo"
                    }
                },
                { $unwind: "$jobInfo" },
                { $match: catAppFilter },
                {
                    $group: {
                        _id: "$applications.status",
                        count: { $sum: 1 }
                    }
                }
            ]);

            let trials = 0;
            let hired = 0;
            appsAgg.forEach(a => {
                if (['Demo Scheduled', 'Reschedule Requested'].includes(a._id)) {
                    trials += a.count;
                } else if (a._id === 'Hired') {
                    hired += a.count;
                }
            });

            const catJobs = await Job.find(catJobFilter).select('_id');
            const catJobIds = catJobs.map(j => j._id);

            const catApplications = await ApplicationModel.find({ job: { $in: catJobIds } }).select('_id');
            const catAppIds = catApplications.map(a => a._id);

            const catTxAgg = await Transaction.aggregate([
                { $match: { status: 'success', relatedJob: { $in: catJobIds } } },
                { $group: { _id: null, total: { $sum: "$amount" } } }
            ]);
            const catTxRevenue = catTxAgg.length > 0 ? catTxAgg[0].total : 0;

            const catSpAgg = await ServicePackagePayment.aggregate([
                { $match: { status: 'paid', application: { $in: catAppIds } } },
                { $group: { _id: null, total: { $sum: "$amount" } } }
            ]);
            const catSpRevenue = catSpAgg.length > 0 ? catSpAgg[0].total : 0;

            const revenue = catTxRevenue + catSpRevenue;

            let displayCategoryName = 'Commercial';
            if (cat === 'home') displayCategoryName = 'Domestic';
            if (cat === 'daily') displayCategoryName = 'Daily Job';

            return {
                category: displayCategoryName,
                jobsPosted: jobsCount,
                trials,
                hired,
                revenue
            };
        }));

        // 9. Trend Overview (5 points of current month)
        const currentMonth = new Date().getMonth();
        const currentMonthName = new Date().toLocaleString('default', { month: 'short' });
        
        const intervals = [
            { label: '1 ' + currentMonthName, start: 1, end: 7 },
            { label: '8 ' + currentMonthName, start: 8, end: 14 },
            { label: '15 ' + currentMonthName, start: 15, end: 21 },
            { label: '22 ' + currentMonthName, start: 22, end: 28 },
            { label: '31 ' + currentMonthName, start: 29, end: 31 }
        ];

        const trendOverviewSeries = {
            hotel: [0, 0, 0, 0, 0],
            home: [0, 0, 0, 0, 0],
            daily: [0, 0, 0, 0, 0]
        };
        
        for (let i = 0; i < intervals.length; i++) {
            const intVal = intervals[i];
            const startD = new Date(currentYear, currentMonth, intVal.start, 0, 0, 0, 0);
            const endD = new Date(currentYear, currentMonth, intVal.end, 23, 59, 59, 999);
            
            const rawCounts = await Candidate.aggregate([
                { $match: { ...candidateQuery } },
                { $unwind: "$applications" },
                { $match: { "applications.appliedDate": { $gte: startD, $lte: endD } } },
                {
                    $lookup: {
                        from: "jobs",
                        localField: "applications.job",
                        foreignField: "_id",
                        as: "jobInfo"
                    }
                },
                { $unwind: "$jobInfo" },
                {
                    $group: {
                        _id: "$jobInfo.jobCategory",
                        count: { $sum: 1 }
                    }
                }
            ]);
            
            rawCounts.forEach(c => {
                if (trendOverviewSeries[c._id]) {
                    trendOverviewSeries[c._id][i] = c.count;
                }
            });
        }

        res.json({
            success: true,
            stats: {
                totalJobs,
                totalCandidates,
                totalCustomers,
                pendingCandidates,
                totalApplications,
                newApplied: statsMap['Applied'],
                shortlisted: statsMap['Shortlisted'],
                demoScheduled: statsMap['Demo Scheduled'],
                rescheduleRequested: statsMap['Reschedule Requested'],
                hired: statsMap['Hired'],
                rejected: statsMap['Rejected'],
                onHold: statsMap['On Hold'],
                notInterested: statsMap['Not Interested'],
                totalTransactions: totalRevenue,
                activeSubscriptions: activeSubscriptions
            },
            charts: {
                categoryDistribution: categoryStats,
                applicationGrowth: growthStats,
                trendOverview: {
                    labels: intervals.map(i => i.label),
                    series: [
                        { name: 'Commercial', data: trendOverviewSeries.hotel },
                        { name: 'Domestic', data: trendOverviewSeries.home },
                        { name: 'Daily Job', data: trendOverviewSeries.daily }
                    ]
                },
                statusOverview: applicationStats,
                successPercentage,
                medianRatio,
                performanceScore,
                radarData,
                sparklines: {
                    dailyCandidates: fillDays(rawDailyCandidates),
                    dailyApplications: fillDays(rawDailyApplications),
                    dailyDemo: fillDays(rawDailyDemo),
                    dailyHired: fillDays(rawDailyHired)
                }
            },
            tableData,
            categoryPerformance,
            recentJobs,
            recentTrials,
            latestTransactions
        });

    } catch (error) {
        console.error('Dashboard Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get granular job stats for a specific position
 * @route   GET /api/dashboard/position-jobs
 * @access  Private
 */
const getPositionJobStats = async (req, res) => {
    try {
        const { position } = req.query;
        if (!position) return res.status(400).json({ success: false, message: 'Position is required' });

        // 1. Get all jobs for this position
        const jobs = await Job.find({ jobPosition: position });

        // 2. Get application stats for these jobs
        const jobIds = jobs.map(j => j._id);
        const appStats = await Candidate.aggregate([
            { $unwind: "$applications" },
            { $match: { "applications.job": { $in: jobIds } } },
            {
                $group: {
                    _id: {
                        jobId: "$applications.job",
                        status: "$applications.status"
                    },
                    count: { $sum: 1 }
                }
            }
        ]);

        // 3. Format response
        const tableData = jobs.map(job => {
            const jobApps = appStats.filter(a => a._id.jobId.toString() === job._id.toString());
            const getCount = (status) => jobApps.find(a => a._id.status === status)?.count || 0;

            const vacancyStr = job.jobCategory === 'daily' ? job.noOfGuests : job.packageOrGuestOrVacancy;
            const vacancy = parseInt(vacancyStr) || 0;

            return {
                _id: job._id,
                title: job.title || 'Untitled Job',
                vacancy: vacancy,
                applied: getCount('Applied'),
                assigned: getCount('Shortlisted'),
                demo: getCount('Demo Scheduled'),
                reschedule: getCount('Reschedule Requested'),
                rejected: getCount('Rejected'),
                onHold: getCount('On Hold'),
                notInterested: getCount('Not Interested'),
                hired: getCount('Hired')
            };
        });

        res.json({ success: true, tableData });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getDashboardStats,
    getPositionJobStats
};
