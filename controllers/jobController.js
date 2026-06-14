const Job = require('../models/Job');

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

        // Limit check for Users (Employers)
        if (req.admin.constructor.modelName === 'User') {
            const user = req.admin;
            // Allow if there's no limit set yet (optional default behavior, or block them)
            // Assuming currentJobPostLimit > 0 means they have a plan. 
            // If they have no plan, block them.
            if (!user.activePlan) {
                return res.status(403).json({ success: false, message: 'Please purchase a Subscription Plan to post jobs.' });
            }
            if (user.jobsPostedInCurrentPlan >= user.currentJobPostLimit) {
                return res.status(403).json({ success: false, message: 'Job posting limit reached for your current plan. Please upgrade your plan.' });
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
 * @desc    Get all jobs
 * @route   GET /api/jobs
 * @access  Private (Admin)
 */
const getJobs = async (req, res) => {
    try {
        const { jobCategory, city, status, isActive } = req.query;
        let query = {};

        // Role-based data isolation
        const isSuperAdmin = req.admin.constructor.modelName === 'Admin';
        const isCook = req.admin.role && req.admin.role.name && req.admin.role.name.toLowerCase() === 'cook';
        if (!isSuperAdmin && !isCook) {
            query.createdBy = req.admin._id;
        }

        if (jobCategory) query.jobCategory = jobCategory;
        if (city) query.city = new RegExp(city, 'i');
        if (status) query.status = status;
        if (isActive !== undefined) query.isActive = isActive === 'true';

        const jobs = await Job.find(query)
            .populate('customer', 'name email contactPhone')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: jobs.length,
            jobs
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get single job
 * @route   GET /api/jobs/:id
 * @access  Private (Admin)
 */
const getJob = async (req, res) => {
    try {
        const job = await Job.findById(req.params.id).populate('customer');

        if (!job) {
            return res.status(404).json({ success: false, message: 'Job not found' });
        }

        res.status(200).json({
            success: true,
            job
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

        // Use updateOne to bypass validation for other fields (like creatorModel) 
        // that might be missing in older records.
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

module.exports = {
    createJob,
    getJobs,
    getJob,
    updateJob,
    deleteJob,
    toggleJobStatus,
    updateJobStatus
};
