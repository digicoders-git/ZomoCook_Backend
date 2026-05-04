const Job = require('../models/Job');
const Candidate = require('../models/Candidate');
const Customer = require('../models/Customer');
const mongoose = require('mongoose');

/**
 * @desc    Get dashboard statistics with filters
 * @route   GET /api/dashboard
 * @access  Private
 */
const getDashboardStats = async (req, res) => {
    try {
        const { category, customer, position, date } = req.query;

        const isSuperAdmin = req.admin.constructor.modelName === 'Admin';
        
        // Construct dynamic filter for Jobs
        const jobFilter = {};
        if (!isSuperAdmin) {
            jobFilter.createdBy = req.admin._id;
        }

        if (category) jobFilter.jobCategory = category;
        if (customer) jobFilter.customer = new mongoose.Types.ObjectId(customer);
        if (position) jobFilter.jobPosition = position;
        if (date) {
            const start = new Date(date);
            const end = new Date(date);
            end.setDate(end.getDate() + 1);
            jobFilter.createdAt = { $gte: start, $lt: end };
        }

        // Construct dynamic filter for Candidates/Applications
        const appMatchFilter = {};
        if (!isSuperAdmin) {
            appMatchFilter.createdBy = req.admin._id;
        }

        if (category) appMatchFilter["jobInfo.jobCategory"] = category;
        if (customer) appMatchFilter["jobInfo.customer"] = new mongoose.Types.ObjectId(customer);
        if (position) appMatchFilter["jobInfo.jobPosition"] = position;
        if (date) {
            const start = new Date(date);
            const end = new Date(date);
            end.setDate(end.getDate() + 1);
            appMatchFilter["applications.appliedDate"] = { $gte: start, $lt: end };
        }

        // 1. Basic Stats
        const totalJobs = await Job.countDocuments(jobFilter);
        const totalCandidates = await Candidate.countDocuments(!isSuperAdmin ? { createdBy: req.admin._id } : {});
        const totalCustomers = await Customer.countDocuments(!isSuperAdmin ? { createdBy: req.admin._id } : {});
        const pendingCandidates = await Candidate.countDocuments({ 
            kycStatus: 'pending',
            ...(!isSuperAdmin ? { createdBy: req.admin._id } : {})
        });

        // 2. Application Status Counts
        const applicationStats = await Candidate.aggregate([
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

        // 3. Category Distribution (Jobs)
        const categoryStats = await Job.aggregate([
            { $match: jobFilter },
            {
                $group: {
                    _id: "$jobCategory",
                    count: { $sum: 1 }
                }
            }
        ]);

        // 4. Monthly Application Growth (Last 6 months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const growthStats = await Candidate.aggregate([
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
            { $match: { createdAt: { $gte: elevenDaysAgo } } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    count: { $sum: 1 }
                }
            }
        ]);

        // Daily applications
        const rawDailyApplications = await Candidate.aggregate([
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
                notInterested: statsMap['Not Interested']
            },
            charts: {
                categoryDistribution: categoryStats,
                applicationGrowth: growthStats,
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
            tableData
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
