const Job = require('../models/Job');
const Candidate = require('../models/Candidate');

const normalizeCategory = (cat) => {
    if (!cat) return '';
    const clean = cat.trim().toLowerCase();
    if (clean === 'commercial') return 'hotel';
    if (clean === 'domestic') return 'home';
    return clean;
};

/**
 * @desc    Create new job
 * @route   POST /api/jobs
 * @access  Private (Admin)
 */
const createJob = async (req, res) => {
    try {
        // Generate Job Code
        const lastJob = await Job.findOne().sort({ createdAt: -1 });
        let nextNumber = 1;
        if (lastJob && lastJob.jobCode) {
            const lastNumber = parseInt(lastJob.jobCode.replace('ZOMO', ''));
            if (!isNaN(lastNumber)) nextNumber = lastNumber + 1;
        }
        const jobCode = `ZOMO${nextNumber}`;

        // Payment check for Users (Employers)
        if (req.admin.constructor.modelName === 'User') {
            const User = require('../models/User');
            const Plan = require('../models/Plan');
            const fullUser = await User.findById(req.admin._id).populate('activePlan');
            const jobCategory = req.body.jobCategory;
            const reqCat = normalizeCategory(jobCategory);
            const hasActivePlan = fullUser.activePlan && fullUser.planExpiryDate && new Date(fullUser.planExpiryDate) > new Date();
            const planAllowsCategory = hasActivePlan && (
                !fullUser.activePlan.allowedJobCategories ||
                fullUser.activePlan.allowedJobCategories.length === 0 ||
                fullUser.activePlan.allowedJobCategories.map(c => normalizeCategory(c)).includes(reqCat)
            );
            const withinLimit = planAllowsCategory && fullUser.jobsPostedInCurrentPlan < fullUser.currentJobPostLimit;

            if (!withinLimit) {
                // Daily job: must have paid 25% advance (paymentStatus in body)
                if (reqCat === 'daily') {
                    if (req.body.paymentStatus !== 'paid') {
                        return res.status(402).json({
                            success: false,
                            requiresPayment: true,
                            paymentType: 'daily_job_advance',
                            advancePercent: 25,
                            message: 'Daily job requires 25% advance payment before posting.'
                        });
                    }
                } else {
                    // Regular job: must have paid ₹299
                    if (req.body.paymentStatus !== 'paid') {
                        return res.status(402).json({
                            success: false,
                            requiresPayment: true,
                            paymentType: 'job_post_fee',
                            amount: 299,
                            message: 'Please pay ₹299 to post this job.'
                        });
                    }
                }
            }
        }

        const jobData = {
            ...req.body,
            jobCode,
            image: req.file ? req.file.path : undefined,
            createdBy: req.admin._id,
            creatorModel: req.admin.constructor.modelName
        };

        const job = await Job.create(jobData);

        // Send push notification to all cooks
        const notificationController = require('./notificationController');
        const salaryText = job.salaryRange ? `Salary ${job.salaryRange}` : 'Good Salary';
        const cityText = job.city ? `in ${job.city}` : '';
        notificationController.sendNotificationToRole({
            roleName: 'Cook',
            title: '🔔 New Matching Job',
            message: `New Chef Requirement ${cityText}. ${salaryText}. Apply now.`,
            type: 'job_available',
            relatedId: job._id,
            relatedModel: 'Job',
            actionUrl: '/jobs'
        }).catch(err => console.error('Error sending job post push notification:', err));

        if (req.admin.constructor.modelName === 'User') {
            const user = req.admin;
            user.jobsPostedInCurrentPlan += 1;
            await user.save();
        }

        res.status(201).json({
            success: true,
            message: "Job created successfully",
            job
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get all jobs with search, filter & pagination
 * @route   GET /api/jobs
 * @access  Private (Admin & Cook)
 */
const getJobs = async (req, res) => {
    try {
        const { jobCategory, city, state, status, isActive, search, jobType, jobPosition, salaryRange, experienceRange, serviceCategory, minSalary, maxSalary, limit = 50, skip = 0 } = req.query;
        let query = {};

        // Role-based data isolation
        const isSuperAdmin = req.admin.constructor.modelName === 'Admin';
        const isCook = req.admin.role && req.admin.role.name && req.admin.role.name.toLowerCase() === 'cook';

        if (!isSuperAdmin && !isCook) {
            query.createdBy = req.admin._id;
        }

        // Search filter
        if (search) {
            query.$or = [
                { title: new RegExp(search, 'i') },
                { overview: new RegExp(search, 'i') },
                { responsibilities: new RegExp(search, 'i') }
            ];
        }

        if (jobCategory) query.jobCategory = jobCategory;
        if (city) query.city = new RegExp(city, 'i');
        if (state) query.state = new RegExp(state, 'i');
        if (status) query.status = status;
        if (isActive !== undefined) query.isActive = isActive === 'true';
        if (jobType) query.jobType = new RegExp(jobType, 'i');
        if (jobPosition) query.jobPosition = new RegExp(jobPosition, 'i');
        if (salaryRange) query.salaryRange = new RegExp(salaryRange, 'i');
        if (experienceRange) query.experienceRange = new RegExp(experienceRange, 'i');
        if (serviceCategory) query.cookingCategory = new RegExp(serviceCategory, 'i');
        if (minSalary || maxSalary) {
            // salaryRange is stored as string like "15000-20000", filter numerically
            if (minSalary) query.$expr = { $gte: [{ $toInt: { $arrayElemAt: [{ $split: ['$salaryRange', '-'] }, 0] } }, parseInt(minSalary)] };
        }

        // Active jobs filter for cook viewing
        if (isCook) query.isActive = true;

        let jobs = await Job.find(query)
            .populate('customer', 'name email contactPhone')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip));

        const totalCount = await Job.countDocuments(query);

        // Add isSaved flag and status counts
        let savedJobIds = [];
        if (isCook) {
            const last10 = req.admin.phone ? req.admin.phone.slice(-10) : '';
            const candidate = await Candidate.findOne({
                $or: [
                    { _id: req.admin._id },
                    { createdBy: req.admin._id },
                    { phone: last10 ? new RegExp(last10 + '$') : req.admin.phone }
                ]
            });
            savedJobIds = candidate?.savedJobs || [];
        }

        const Application = require('../models/Application');
        const jobsWithCounts = await Promise.all(jobs.map(async (job) => {
            const apps = await Application.find({ job: job._id });
            const assignedCandidates = apps.filter(app => app.status === 'Applied').length;
            const interviews = apps.filter(app => ['Shortlisted', 'Demo Scheduled', 'Reschedule Requested'].includes(app.status)).length;
            const rejected = apps.filter(app => ['Rejected', 'Not Interested', 'On Hold'].includes(app.status)).length;
            const selected = apps.filter(app => app.status === 'Hired').length;

            return {
                ...job.toObject(),
                assignedCandidates,
                interviews,
                rejected,
                selected,
                isSaved: isCook ? savedJobIds.some(id => id.toString() === job._id.toString()) : undefined
            };
        }));

        res.status(200).json({
            success: true,
            count: jobsWithCounts.length,
            total: totalCount,
            jobs: jobsWithCounts
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get single job
 * @route   GET /api/jobs/:id
 * @access  Private (Admin & Cook)
 */
const getJob = async (req, res) => {
    try {
        const job = await Job.findById(req.params.id).populate('customer');

        if (!job) {
            return res.status(404).json({ success: false, message: 'Job not found' });
        }

        // Check if cook has saved this job
        let isSaved = false;
        const isCook = req.admin.role && req.admin.role.name && req.admin.role.name.toLowerCase() === 'cook';
        if (isCook) {
            const last10 = req.admin.phone ? req.admin.phone.slice(-10) : '';
            const candidate = await Candidate.findOne({
                $or: [
                    { _id: req.admin._id },
                    { createdBy: req.admin._id },
                    { phone: last10 ? new RegExp(last10 + '$') : req.admin.phone }
                ]
            });
            isSaved = candidate?.savedJobs?.includes(job._id) || false;
        }

        const Application = require('../models/Application');
        const apps = await Application.find({ job: job._id });
        const assignedCandidates = apps.filter(app => app.status === 'Applied').length;
        const interviews = apps.filter(app => ['Shortlisted', 'Demo Scheduled', 'Reschedule Requested'].includes(app.status)).length;
        const rejected = apps.filter(app => ['Rejected', 'Not Interested', 'On Hold'].includes(app.status)).length;
        const selected = apps.filter(app => app.status === 'Hired').length;

        const jobWithCounts = {
            ...job.toObject(),
            assignedCandidates,
            interviews,
            rejected,
            selected
        };

        res.status(200).json({
            success: true,
            job: jobWithCounts,
            isSaved
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Update job
 * @route   PUT /api/jobs/:id
 * @access  Private (Admin)
 */
const updateJob = async (req, res) => {
    try {
        let job = await Job.findById(req.params.id);

        if (!job) {
            return res.status(404).json({ success: false, message: 'Job not found' });
        }

        // Handle image update
        if (req.file) {
            req.body.image = req.file.path;
        }

        job = await Job.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        res.status(200).json({
            success: true,
            message: "Job updated successfully",
            job
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Delete job
 * @route   DELETE /api/jobs/:id
 * @access  Private (Admin)
 */
const deleteJob = async (req, res) => {
    try {
        const job = await Job.findById(req.params.id);

        if (!job) {
            return res.status(404).json({ success: false, message: 'Job not found' });
        }

        await job.deleteOne();

        res.status(200).json({
            success: true,
            message: "Job deleted successfully"
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const toggleJobStatus = async (req, res) => {
    try {
        const job = await Job.findById(req.params.id);

        if (!job) {
            return res.status(404).json({ success: false, message: 'Job not found' });
        }

        const newStatus = !job.isActive;
        const updateDoc = {
            isActive: newStatus,
            status: newStatus ? 'New' : 'Inactive'
        };

        await Job.updateOne(
            { _id: req.params.id },
            { $set: updateDoc }
        );

        res.status(200).json({
            success: true,
            message: `Job status updated to ${newStatus ? 'New' : 'Inactive'}`,
            isActive: newStatus,
            status: updateDoc.status
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Update job status string
 * @route   PATCH /api/jobs/:id/status-string
 * @access  Private (Admin)
 */
const updateJobStatus = async (req, res) => {
    try {
        const { status } = req.body;

        const updateDoc = { status };
        if (status === 'Active' || status === 'New' || status === 'Urgent') {
            updateDoc.isActive = true;
        } else if (status === 'Inactive' || status === 'Cancelled' || status === 'Expired') {
            updateDoc.isActive = false;
        }

        const result = await Job.updateOne(
            { _id: req.params.id },
            { $set: updateDoc }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ success: false, message: 'Job not found' });
        }

        res.status(200).json({
            success: true,
            message: `Job status updated to ${status}`,
            status: status,
            isActive: updateDoc.isActive
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Save job for cook
 * @route   POST /api/jobs/:id/save
 * @access  Private (Cook)
 */
const saveJob = async (req, res) => {
    try {
        const jobId = req.params.id;
        const last10 = req.admin.phone ? req.admin.phone.slice(-10) : '';
        const candidate = await Candidate.findOne({
            $or: [
                { _id: req.admin._id },
                { createdBy: req.admin._id },
                { phone: last10 ? new RegExp(last10 + '$') : req.admin.phone }
            ]
        });
        if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });

        if (!candidate.savedJobs) candidate.savedJobs = [];
        if (!candidate.savedJobs.includes(jobId)) {
            candidate.savedJobs.push(jobId);
            await candidate.save();
        }

        res.status(200).json({ success: true, message: 'Job saved successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Unsave job for cook
 * @route   DELETE /api/jobs/:id/save
 * @access  Private (Cook)
 */
const unsaveJob = async (req, res) => {
    try {
        const jobId = req.params.id;
        const last10 = req.admin.phone ? req.admin.phone.slice(-10) : '';
        const candidate = await Candidate.findOne({
            $or: [
                { _id: req.admin._id },
                { createdBy: req.admin._id },
                { phone: last10 ? new RegExp(last10 + '$') : req.admin.phone }
            ]
        });
        if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });

        await Candidate.findByIdAndUpdate(
            candidate._id,
            { $pull: { savedJobs: jobId } },
            { new: true }
        );

        res.status(200).json({ success: true, message: 'Job unsaved successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get saved jobs for cook
 * @route   GET /api/jobs/saved
 * @access  Private (Cook)
 */
const getSavedJobs = async (req, res) => {
    try {
        const last10 = req.admin.phone ? req.admin.phone.slice(-10) : '';
        const candidate = await Candidate.findOne({
            $or: [
                { _id: req.admin._id },
                { createdBy: req.admin._id },
                { phone: last10 ? new RegExp(last10 + '$') : req.admin.phone }
            ]
        }).populate({
            path: 'savedJobs',
            model: 'Job'
        });

        if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });

        res.status(200).json({
            success: true,
            count: candidate.savedJobs?.length || 0,
            jobs: candidate.savedJobs || []
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createJob,
    getJobs,
    getJob,
    updateJob,
    deleteJob,
    toggleJobStatus,
    updateJobStatus,
    saveJob,
    unsaveJob,
    getSavedJobs
};

// Add applyForJob to exports at the end
const oldExports = module.exports;
const Application = require('../models/Application');

const applyForJob = async (req, res) => {
    try {
        const jobId = req.params.id;

        const job = await Job.findById(jobId);
        if (!job) return res.status(404).json({ success: false, message: 'Job not found' });

        const last10 = req.admin.phone ? req.admin.phone.slice(-10) : '';
        const candidate = await Candidate.findOne({
            $or: [
                { _id: req.admin._id },
                { createdBy: req.admin._id },
                { phone: last10 ? new RegExp(last10 + '$') : req.admin.phone }
            ]
        });
        if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });

        const existingApp = await Application.findOne({ job: jobId, candidate: candidate._id });
        if (existingApp) {
            return res.status(400).json({ success: false, message: 'Already applied' });
        }

        const application = await Application.create({
            job: jobId,
            candidate: candidate._id,
            customer: job.createdBy,
            status: 'Applied'
        });

        // Send push notification to the customer/chef who posted the job
        const notificationController = require('./notificationController');
        notificationController.sendNotificationToUser({
            userId: job.createdBy,
            userModel: 'User',
            title: '📝 New Job Application',
            message: `${candidate.name} has applied for your job "${job.title}".`,
            type: 'application_status',
            relatedId: application._id,
            relatedModel: 'Application',
            actionUrl: '/applications'
        }).catch(err => console.error('Error sending job apply push notification:', err));

        // Add to candidate's applications array (for backward compatibility)
        await Candidate.findByIdAndUpdate(
            candidate._id,
            { $push: { applications: { job: jobId, status: 'Applied', appliedDate: new Date() } } },
            { new: true }
        );

        res.status(201).json({ success: true, message: 'Applied successfully', application });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    ...oldExports,
    applyForJob
};
