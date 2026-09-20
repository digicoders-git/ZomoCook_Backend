const Job = require('../models/Job');
const Candidate = require('../models/Candidate');
const WebSetting = require('../models/WebSetting');
const { hasPermission } = require('../middleware/permissionHelper');

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
        // Generate robust unique Job Code
        let nextNumber = 1;
        const highestJob = await Job.findOne({ jobCode: { $regex: /^ZOMO\d+$/ } }).sort({ createdAt: -1 });
        if (highestJob && highestJob.jobCode) {
            const num = parseInt(highestJob.jobCode.replace('ZOMO', ''), 10);
            if (!isNaN(num)) nextNumber = num + 1;
        } else {
            const count = await Job.countDocuments();
            nextNumber = count + 1;
        }
        let jobCode = `ZOMO${nextNumber}`;
        while (await Job.exists({ jobCode })) {
            nextNumber++;
            jobCode = `ZOMO${nextNumber}`;
        }

        let requiresPayment = false;
        let paymentInfo = null;
        let jobStatus = 'New';
        let isActive = true;
        let finalPaymentStatus = req.body.paymentStatus || 'free';

        // Payment check for Users (Employers)
        if (req.admin.constructor.modelName === 'User') {
            const User = require('../models/User');
            const Plan = require('../models/Plan');
            const fullUser = await User.findById(req.admin._id).populate('activePlan');
            const jobCategory = req.body.jobCategory;
            const reqCat = normalizeCategory(jobCategory);
            const hasActivePlan = fullUser && fullUser.activePlan && fullUser.planExpiryDate && new Date(fullUser.planExpiryDate) > new Date();
            const planAllowsCategory = hasActivePlan && (
                !fullUser.activePlan.allowedJobCategories ||
                fullUser.activePlan.allowedJobCategories.length === 0 ||
                fullUser.activePlan.allowedJobCategories.map(c => normalizeCategory(c)).includes(reqCat)
            );
            const jobsPosted = fullUser ? (fullUser.jobsPostedInCurrentPlan || 0) : 0;
            const postLimit = fullUser ? (fullUser.currentJobPostLimit || 0) : 0;
            const withinLimit = planAllowsCategory && jobsPosted < postLimit;

            if (!withinLimit) {
                // Daily job: must have paid 25% advance (paymentStatus in body)
                if (reqCat === 'daily') {
                    if (req.body.paymentStatus !== 'paid') {
                        requiresPayment = true;
                        paymentInfo = {
                            paymentType: 'daily_job_advance',
                            advancePercent: 25,
                            message: 'Daily job requires 25% advance payment before posting.'
                        };
                    }
                } else {
                    // Regular job: Check WebSetting for dynamic fee
                    const settings = await WebSetting.findOne() || {};
                    const isFeeActive = settings.jobPostFeeStatus !== undefined ? settings.jobPostFeeStatus : true;
                    const feeAmount = settings.jobPostFee !== undefined ? settings.jobPostFee : 299;

                    if (isFeeActive && req.body.paymentStatus !== 'paid') {
                        requiresPayment = true;
                        paymentInfo = {
                            paymentType: 'job_post_fee',
                            amount: feeAmount,
                            message: `Please pay ₹${feeAmount} to post this job.`
                        };
                    }
                }
            }
        }

        if (requiresPayment) {
            jobStatus = 'Hold';
            isActive = false;
            finalPaymentStatus = 'pending';
        }

        let assignedManagerId = '';
        try {
            const Role = require('../models/Role');
            const Admin = require('../models/Admin');
            const leadManagerRole = await Role.findOne({ name: { $regex: /lead manager/i } });
            if (leadManagerRole) {
                const leadManagers = await Admin.find({ role: leadManagerRole._id, status: 'Active' });
                if (leadManagers.length > 0) {
                    const randomManager = leadManagers[Math.floor(Math.random() * leadManagers.length)];
                    assignedManagerId = randomManager._id.toString();
                }
            }
        } catch (e) {
            console.error('Error auto-assigning lead manager:', e);
        }

        const customerId = req.body.customer && req.body.customer.toString().trim() !== '' && req.body.customer !== 'null'
            ? req.body.customer
            : req.admin._id;

        const jobData = {
            ...req.body,
            customer: customerId,
            jobCode,
            status: jobStatus,
            isActive: isActive,
            paymentStatus: finalPaymentStatus,
            image: req.file ? req.file.path : undefined,
            createdBy: req.admin._id,
            creatorModel: req.admin.constructor.modelName || 'User',
            leadManager: assignedManagerId || ''
        };

        // Sanitize date and number fields
        if (!jobData.dateOfEvent || jobData.dateOfEvent === '' || jobData.dateOfEvent === 'null') {
            delete jobData.dateOfEvent;
        }
        if (jobData.latitude === '' || jobData.latitude === null || isNaN(jobData.latitude)) {
            delete jobData.latitude;
        }
        if (jobData.longitude === '' || jobData.longitude === null || isNaN(jobData.longitude)) {
            delete jobData.longitude;
        }

        const job = await Job.create(jobData);

        if (!requiresPayment) {
            // Send push notification to all cooks
            const notificationController = require('./notificationController');
            const salaryText = job.salaryRange ? `Salary ${job.salaryRange}` : 'Good Salary';
            const cityText = job.city ? `in ${job.city}` : '';
            notificationController.sendNotificationToRole({
                roleName: 'Cook',
                title: 'New Matching Job',
                message: `New Chef Requirement ${cityText}. ${salaryText}. Apply now.`,
                type: 'job_available',
                relatedId: job._id,
                relatedModel: 'Job',
                actionUrl: '/jobs'
            }).catch(err => console.error('Error sending job post push notification:', err));

            if (req.admin.constructor.modelName === 'User') {
                const user = req.admin;
                user.jobsPostedInCurrentPlan = (user.jobsPostedInCurrentPlan || 0) + 1;
                await user.save();
            }
        }

        res.status(201).json({
            success: true,
            message: requiresPayment ? paymentInfo.message : "Job created successfully",
            job,
            requiresPayment,
            paymentInfo
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
        const { jobCategory, city, state, status, isActive, search, jobType, jobPosition, salaryRange, experienceRange, serviceCategory, minSalary, maxSalary, limit = 100000, skip = 0, paymentStatus, leadManager } = req.query;
        let query = {};
        // Super Admin: has type='admin' OR is the hardcoded super admin email OR has super admin role
        const isSuperAdmin =
            req.admin.constructor.modelName === 'Admin' && (
                !req.admin.role ||
                req.admin.email === 'zomocookadmin@gmail.com' ||
                (req.admin.role && req.admin.role.name && req.admin.role.name.toLowerCase() === 'super admin')
            );
        // Role name detection
        const roleName = (req.admin.role && req.admin.role.name) ? req.admin.role.name.toLowerCase() : '';
        const isCook = roleName === 'cook';
        const canViewJobs = hasPermission(req.admin, 'job_management:view');
        // isCustomer = mobile app user (no admin panel role, just a regular app user)
        // Staff users (Lead Manager, Telecaller etc) are in User collection but HAVE a role assigned
        const isCustomer = req.admin.constructor.modelName === 'User' && 
            (!req.admin.role || roleName === 'user' || roleName === 'customer');

        if (isCustomer) {
            query.createdBy = req.admin._id;
        } else if (!isSuperAdmin && !isCook) {
            // Staff User / Lead Manager — show only assigned leads
            query.$and = query.$and || [];
            const makeFlexibleRegex = (s) => {
                const cleaned = String(s || '').toLowerCase().replace(/[\s_-]/g, '');
                if (!cleaned) return new RegExp('^$');
                const pattern = '^[\\s_-]*' + cleaned.split('').map(c => c.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('[\\s_-]*') + '[\\s_-]*$';
                return new RegExp(pattern, 'i');
            };
            query.$and.push({
                $or: [
                    { leadManager: req.admin._id.toString() },
                    { leadManager: makeFlexibleRegex(req.admin.name) },
                    { leadManager: makeFlexibleRegex(req.admin.email) }
                ]
            });
        }

        // Search filter — use $and to avoid conflict with leadManager $or
        if (search) {
            query.$and = query.$and || [];
            query.$and.push({
                $or: [
                    { title: new RegExp(search, 'i') },
                    { overview: new RegExp(search, 'i') },
                    { responsibilities: new RegExp(search, 'i') }
                ]
            });
        }

        if (jobCategory) query.jobCategory = jobCategory;
        if (city) query.city = new RegExp(city, 'i');
        if (state) query.state = new RegExp(state, 'i');
        if (status) query.status = status;
        if (isActive !== undefined) query.isActive = isActive === 'true';
        if (leadManager) query.leadManager = leadManager;

        if (paymentStatus) {
            if (paymentStatus === 'unpaid' || paymentStatus === 'free') {
                query.paymentStatus = 'free';
            } else if (paymentStatus === 'paid') {
                query.paymentStatus = 'paid';
            } else {
                query.paymentStatus = paymentStatus;
            }
        }
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
        const User = require('../models/User');
        const jobsWithCounts = await Promise.all(jobs.map(async (job) => {
            const apps = await Application.find({ job: job._id });
            const assignedCandidates = apps.filter(app => ['Applied', 'Profile Reviewed'].includes(app.status)).length;
            const interviews = apps.filter(app => ['Shortlisted', 'Demo Scheduled', 'Demo In Progress', 'Demo Completed', 'Reschedule Requested', 'On Hold'].includes(app.status)).length;
            const selected = apps.filter(app => ['Package Selected', 'Package Paid'].includes(app.status) || (app.status === 'Hired' && app.offerStatus !== 'accepted')).length;
            const hired = apps.filter(app => ['Offer Accepted', 'Joined'].includes(app.status) || (app.status === 'Hired' && app.offerStatus === 'accepted') || app.offerStatus === 'accepted').length;
            const rejected = apps.filter(app => ['Rejected', 'Cancelled', 'Demo Cancelled', 'Not Interested', 'Offer Rejected', 'Rejected by Cook'].includes(app.status) || app.offerStatus === 'rejected').length;

            let customerData = job.customer;
            if (!customerData) {
                const targetId = job.toObject().customer || (job.creatorModel === 'User' ? job.createdBy : null);
                if (targetId) {
                    const userDoc = await User.findById(targetId).select('name email phone');
                    if (userDoc) {
                        customerData = {
                            _id: userDoc._id,
                            name: userDoc.name,
                            email: userDoc.email,
                            contactPhone: userDoc.phone
                        };
                    }
                }
            }

            return {
                ...job.toObject(),
                customer: customerData,
                assignedCandidates,
                interviews,
                selected,
                hired,
                rejected,
                appliedCount: apps.length,
                assignedCount: assignedCandidates,
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

        const isSuperAdmin =
            req.admin.constructor.modelName === 'Admin' && (
                !req.admin.role ||
                req.admin.email === 'zomocookadmin@gmail.com' ||
                (req.admin.role && req.admin.role.name && req.admin.role.name.toLowerCase() === 'super admin')
            );
        const gJobRoleName = (req.admin.role && req.admin.role.name) ? req.admin.role.name.toLowerCase() : '';
        const isCook = gJobRoleName === 'cook';
        // isCustomer = only actual mobile app users (no role, or role is "user"/"customer")
        const isCustomerUser = req.admin.constructor.modelName === 'User' && 
            (!req.admin.role || gJobRoleName === 'user' || gJobRoleName === 'customer');
        
        const canViewThisJob = hasPermission(req.admin, 'job_management:view');
        if (!isSuperAdmin && !isCook && !isCustomerUser && !canViewThisJob) {
            // Staff user without job_management:view - check they have access to this lead
            const cleanStr = (s) => String(s || '').toLowerCase().replace(/[\s_-]/g, '');
            const lm = cleanStr(job.leadManager);
            const meName = cleanStr(req.admin.name);
            const meId = cleanStr(req.admin._id);
            const meEmail = cleanStr(req.admin.email);
            if (lm !== meName && lm !== meId && lm !== meEmail) {
                return res.status(403).json({ success: false, message: 'Access denied to this job lead.' });
            }
        }

        // Check if cook has saved this job
        let isSaved = false;
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
        const assignedCandidates = apps.filter(app => ['Applied', 'Profile Reviewed'].includes(app.status)).length;
        const interviews = apps.filter(app => ['Shortlisted', 'Demo Scheduled', 'Demo In Progress', 'Demo Completed', 'Reschedule Requested', 'On Hold'].includes(app.status)).length;
        const selected = apps.filter(app => ['Package Selected', 'Package Paid'].includes(app.status) || (app.status === 'Hired' && app.offerStatus !== 'accepted')).length;
        const hired = apps.filter(app => ['Offer Accepted', 'Joined'].includes(app.status) || (app.status === 'Hired' && app.offerStatus === 'accepted') || app.offerStatus === 'accepted').length;
        const rejected = apps.filter(app => ['Rejected', 'Cancelled', 'Demo Cancelled', 'Not Interested', 'Offer Rejected', 'Rejected by Cook'].includes(app.status) || app.offerStatus === 'rejected').length;

        let customerData = job.customer;
        if (!customerData) {
            const targetId = job.toObject().customer || (job.creatorModel === 'User' ? job.createdBy : null);
            if (targetId) {
                const User = require('../models/User');
                const userDoc = await User.findById(targetId).select('name email phone');
                if (userDoc) {
                    customerData = {
                        _id: userDoc._id,
                        name: userDoc.name,
                        email: userDoc.email,
                        contactPhone: userDoc.phone
                    };
                }
            }
        }

        const jobWithCounts = {
            ...job.toObject(),
            customer: customerData,
            assignedCandidates,
            interviews,
            selected,
            hired,
            rejected,
            appliedCount: apps.length,
            assignedCount: assignedCandidates
        };

        const Transaction = require('../models/Transaction');
        const transaction = await Transaction.findOne({
            relatedJob: job._id,
            status: 'success'
        }).populate('user', 'name phone').populate('customer', 'name phone');

        res.status(200).json({
            success: true,
            job: jobWithCounts,
            isSaved,
            transaction: transaction || null
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

        const isLeadManager = req.admin.role && req.admin.role.name && req.admin.role.name.toLowerCase().includes('lead manager');

        if (isLeadManager) {
            job.leadManager = undefined;
            await job.save();
            return res.status(200).json({
                success: true,
                message: "Job unassigned successfully (removed from your panel)"
            });
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

        // Send push notification to the job creator
        if (job.createdBy) {
            const notificationController = require('./notificationController');
            const statusLabel = newStatus ? '✅ Job Activated' : '⏸️ Job Deactivated';
            const statusMsg = newStatus
                ? `Your job "${job.title}" has been activated and is now live.`
                : `Your job "${job.title}" has been deactivated by admin.`;
            notificationController.sendNotificationToUser({
                userId: job.createdBy,
                userModel: job.creatorModel || 'User',
                title: statusLabel,
                message: statusMsg,
                type: 'job_status',
                relatedId: job._id,
                relatedModel: 'Job',
                actionUrl: '/jobs'
            }).catch(err => console.error('Error sending toggle status notification:', err));
        }

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
        if (status === 'Active' || status === 'New' || status === 'Urgent' || status === 'Open' || status === 'In Progress') {
            updateDoc.isActive = true;
        } else if (status === 'Inactive' || status === 'Cancelled' || status === 'Expired' || status === 'Closed' || status === 'Hold') {
            updateDoc.isActive = false;
        }

        const job = await Job.findById(req.params.id);
        if (!job) {
            return res.status(404).json({ success: false, message: 'Job not found' });
        }

        await Job.updateOne(
            { _id: req.params.id },
            { $set: updateDoc }
        );

        // Send push notification to the job creator about status change
        if (job.createdBy) {
            const notificationController = require('./notificationController');
            const statusEmoji = {
                'Active': '✅', 'New': '🆕', 'Urgent': '🚨', 'Open': '🔓',
                'In Progress': '🔄', 'Inactive': '⏸️', 'Cancelled': '❌',
                'Expired': '⏰', 'Closed': '🔒', 'Hold': '⏳'
            };
            const emoji = statusEmoji[status] || '📋';
            notificationController.sendNotificationToUser({
                userId: job.createdBy,
                userModel: job.creatorModel || 'User',
                title: `${emoji} Job Status Updated`,
                message: `Your job "${job.title}" status has been changed to "${status}".`,
                type: 'job_status',
                relatedId: job._id,
                relatedModel: 'Job',
                actionUrl: '/jobs'
            }).catch(err => console.error('Error sending status update notification:', err));
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

const resendJobNotification = async (req, res) => {
    try {
        const job = await Job.findById(req.params.id);
        if (!job) {
            return res.status(404).json({ success: false, message: 'Job not found' });
        }

        const notificationController = require('./notificationController');

        // If the job is pending payment, send payment reminder to the customer/employer
        if (job.paymentStatus === 'pending' || job.status === 'hold') {
            await notificationController.sendNotificationToUser({
                userId: job.createdBy,
                userModel: 'User',
                title: 'Plan Activation Required',
                message: `Please complete the payment for your job post "${job.title}" to activate it and start receiving applications.`,
                type: 'job_status',
                relatedId: job._id,
                relatedModel: 'Job',
                actionUrl: '/jobs'
            });

            return res.status(200).json({
                success: true,
                message: "Payment reminder notification sent successfully to the customer"
            });
        }

        const salaryText = job.salaryRange ? `Salary ${job.salaryRange}` : 'Good Salary';
        const cityText = job.city ? `in ${job.city}` : '';
        
        await notificationController.sendNotificationToRole({
            roleName: 'Cook',
            title: 'Matching Job Reminder',
            message: `Chef Requirement ${cityText}. ${salaryText}. Apply now.`,
            type: 'job_available',
            relatedId: job._id,
            relatedModel: 'Job',
            actionUrl: `/jobs/view/${job._id}`
        });

        res.status(200).json({
            success: true,
            message: "Notification resent successfully to all cooks"
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const completePayment = async (req, res) => {
    try {
        const jobId = req.params.id;
        const job = await Job.findById(jobId);
        if (!job) {
            return res.status(404).json({ success: false, message: 'Job not found' });
        }

        job.paymentStatus = 'paid';
        job.status = 'New';
        job.isActive = true;
        job.createdAt = new Date(); // Reset creation time to when it was actually paid/posted
        await job.save();

        // Ensure a success transaction is logged (especially for manual/offline admin approvals)
        const txnType = job.jobType === 'daily' ? 'daily_job_advance' : 'job_post_fee';
        const Transaction = require('../models/Transaction');
        const existingTxn = await Transaction.findOne({
            relatedJob: jobId,
            type: txnType,
            status: 'success'
        });

        if (!existingTxn) {
            const isCustomer = req.admin.constructor.modelName === 'Customer';
            const finalAmount = job.jobType === 'daily' ? (job.advanceAmount || 0) : (job.jobPostFee || 299);
            const txnData = {
                type: txnType,
                amount: finalAmount,
                status: 'success',
                relatedJob: jobId,
                razorpayOrderId: 'OFFLINE_' + Date.now(),
                razorpayPaymentId: 'MANUAL_' + Date.now(),
                description: job.jobType === 'daily' 
                    ? `Daily job 25% advance marked by: ${req.admin.name || 'Staff'}`
                    : `Job post fee marked by: ${req.admin.name || 'Staff'}`
            };
            if (isCustomer) {
                txnData.customer = req.admin._id;
            } else {
                txnData.user = req.admin._id;
            }
            await Transaction.create(txnData);
        }

        // Send push notification to all cooks now that payment is complete
        const notificationController = require('./notificationController');
        const salaryText = job.salaryRange ? `Salary ${job.salaryRange}` : 'Good Salary';
        const cityText = job.city ? `in ${job.city}` : '';
        notificationController.sendNotificationToRole({
            roleName: 'Cook',
            title: 'New Matching Job',
            message: `New Chef Requirement ${cityText}. ${salaryText}. Apply now.`,
            type: 'job_available',
            relatedId: job._id,
            relatedModel: 'Job',
            actionUrl: '/jobs'
        }).catch(err => console.error('Error sending job post push notification:', err));

        if (job.creatorModel === 'User') {
            const User = require('../models/User');
            const user = await User.findById(job.createdBy);
            if (user) {
                user.jobsPostedInCurrentPlan = (user.jobsPostedInCurrentPlan || 0) + 1;
                await user.save();
            }
        }

        res.status(200).json({
            success: true,
            message: "Payment completed and Job is now active",
            job
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Create commercial job requirement from Website
 * @route   POST /api/jobs/web-commercial-booking
 * @access  Public
 */
const createCommercialWebJob = async (req, res) => {
    try {
        const {
            name,
            phone,
            address,
            outletName,
            familyMembers,
            message,
            staffList,
            selectedPlan,
            pricing
        } = req.body;

        if (!name || !phone) {
            return res.status(400).json({ success: false, message: 'Name and Phone are required' });
        }

        const User = require('../models/User');
        const Customer = require('../models/Customer');
        const Role = require('../models/Role');
        const cleanedPhone = phone.toString().trim();

        // 1. Find or create User with this phone number
        let user = await User.findOne({
            $or: [
                { phone: cleanedPhone },
                { phone: `+91${cleanedPhone}` },
                { phone: cleanedPhone.replace('+91', '') }
            ]
        });

        let customerRole = await Role.findOne({ name: { $regex: /^customer$/i } });
        if (!customerRole) {
            customerRole = await Role.create({ name: 'Customer' });
        }

        if (!user) {
            user = await User.create({
                name: name,
                phone: cleanedPhone,
                address: address || '',
                outletName: outletName || '',
                propertyCategory: 'Hotel/Restaurant',
                status: 'Active',
                role: customerRole._id
            });
        } else {
            user.name = name || user.name;
            if (address) user.address = address;
            if (outletName) user.outletName = outletName;
            await user.save();
        }

        // 2. Find or create Customer in Admin Panel CRM
        let customer = await Customer.findOne({
            $or: [
                { contactPhone: cleanedPhone },
                { contactPhone: `+91${cleanedPhone}` },
                { contactPhone: cleanedPhone.replace('+91', '') }
            ]
        });

        if (!customer) {
            customer = await Customer.create({
                name: name,
                contactName: name,
                contactPhone: cleanedPhone,
                contactAddress: address || '',
                propertyCategory: 'Hotel/Restaurant',
                customerStatus: 'running',
                accountStatus: 'active',
                createdBy: user._id,
                creatorModel: 'User'
            });
        } else {
            customer.name = name || customer.name;
            if (address) customer.contactAddress = address;
            await customer.save();
        }

        // Auto-assign random Lead Manager
        let assignedManagerId = '';
        try {
            const Admin = require('../models/Admin');
            const leadManagerRole = await Role.findOne({ name: { $regex: /lead manager/i } });
            if (leadManagerRole) {
                const leadManagers = await Admin.find({ role: leadManagerRole._id, status: 'Active' });
                if (leadManagers.length > 0) {
                    const randomManager = leadManagers[Math.floor(Math.random() * leadManagers.length)];
                    assignedManagerId = randomManager._id.toString();
                }
            }
        } catch (e) {
            console.error('Error auto-assigning lead manager for web booking:', e);
        }

        // Determine category: 'hotel' | 'home' | 'daily'
        let targetCategory = req.body.jobCategory;
        if (!targetCategory) {
            if (req.body.category === 'home' || req.body.category === 'domestic') targetCategory = 'home';
            else if (req.body.category === 'daily' || req.body.category === 'event') targetCategory = 'daily';
            else targetCategory = 'hotel';
        }

        // 3. Create Jobs for staff items
        const items = (staffList && staffList.length > 0) ? staffList : [{
            category: 'Chef',
            count: 1,
            salary: 25000,
            food: 'Available',
            accommodation: 'Available'
        }];

        const createdJobs = [];

        for (let i = 0; i < items.length; i++) {
            const item = items[i];

            let nextNumber = 1;
            const highestJob = await Job.findOne({ jobCode: { $regex: /^ZOMO\d+$/ } }).sort({ createdAt: -1 });
            if (highestJob && highestJob.jobCode) {
                const num = parseInt(highestJob.jobCode.replace('ZOMO', ''), 10);
                if (!isNaN(num)) nextNumber = num + 1;
            } else {
                nextNumber = (await Job.countDocuments()) + 1;
            }
            let jobCode = `ZOMO${nextNumber}`;
            while (await Job.exists({ jobCode })) {
                nextNumber++;
                jobCode = `ZOMO${nextNumber}`;
            }

            const isParty = req.body.bookingType === 'party';
            const defaultTitle = isParty
                ? `Chef for Party Booking for ${name} (${req.body.partyRequirement?.datesCount || 1} Day Event)`
                : (targetCategory === 'home' 
                    ? `${item.category || 'Home Cook'} Required at ${outletName || name}`
                    : (targetCategory === 'daily' 
                        ? `${item.category || 'Event / Daily Chef'} Required for ${req.body.event || 'Occasion'} at ${outletName || name}`
                        : `${item.category || 'Hospitality Staff'} Required at ${outletName || name}`));

            const jobTitle = defaultTitle;
            const partyDetailsDesc = isParty && req.body.partyRequirement
                ? `Party Details: Dates Count: ${req.body.partyRequirement.datesCount || 1}, City: ${req.body.city || address}, Amount: ₹${pricing?.totalAmount || pricing?.advance || 0}. Payment: ${req.body.partyRequirement.paymentMethod || 'Online'}`
                : '';
            const jobDesc = isParty
                ? `Chef for Party requirement booked by ${name} (+91 ${cleanedPhone}). Location: ${address}. ${partyDetailsDesc}`
                : `Hiring ${item.count || 1} ${item.category || 'Staff'}. Salary ₹${item.salary || 'Negotiable'}. Food: ${item.food || 'Available'}, Accommodation: ${item.accommodation || 'Not Required'}. Plan: ${selectedPlan?.name || 'Basic'}. Location: ${address || 'On Request'}. ${message ? `Notes: ${message}` : ''}`;

            const newJob = await Job.create({
                jobCategory: targetCategory,
                jobCode,
                title: jobTitle,
                customer: customer._id,
                propertyCategory: targetCategory === 'home' ? 'Residence/Home' : (targetCategory === 'daily' ? 'Event/Party' : 'Hotel/Restaurant'),
                state: 'India',
                city: address || 'Delhi NCR',
                overview: jobDesc,
                responsibilities: `Work as ${item.category || 'Staff'} for ${name}.`,
                requirements: `Qualified and verified ${item.category || 'Candidate'}.`,
                jobType: targetCategory === 'daily' ? 'Daily Pay' : 'Full Time',
                jobPosition: item.category || 'Chef',
                salaryRange: item.salary ? `₹${item.salary}${targetCategory === 'daily' ? '' : '/month'}` : (targetCategory === 'daily' ? '₹1500/day' : '₹20000 - ₹35000'),
                packageOrGuestOrVacancy: `${item.count || 1} Staff`,
                event: req.body.event || (targetCategory === 'daily' ? 'Daily / Event' : undefined),
                dateOfEvent: req.body.dateOfEvent ? new Date(req.body.dateOfEvent) : undefined,
                foodPreference: item.food || 'Available',
                status: 'New',
                isActive: true,
                createdBy: user._id,
                creatorModel: 'User',
                paymentStatus: 'paid',
                advanceAmount: pricing?.advance || 0,
                leadManager: assignedManagerId,
                source: 'web'
            });

            createdJobs.push(newJob);
        }

        // Create Cashfree Order for Advance Payment if advance > 0
        let paymentSessionId = null;
        let orderId = null;
        if (pricing && pricing.advance && pricing.advance > 0) {
            try {
                const cfEnvRaw = (process.env.CASHFREE_ENV || 'PRODUCTION').toUpperCase();
                const isProd = cfEnvRaw === 'PROD' || cfEnvRaw === 'PRODUCTION';
                const getCashfreeBaseUrl = () => {
                    return isProd ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';
                };
                const cfHeaders = {
                    'Content-Type': 'application/json',
                    'x-api-version': process.env.CASHFREE_API_VERSION || '2023-08-01',
                    'x-client-id': process.env.CASHFREE_APP_ID || '182270724446849f01322008e4072281',
                    'x-client-secret': process.env.CASHFREE_SECRET_KEY || '08a4432d47c63df7a8e0b26615ab303d96336ad1',
                };

                orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
                const orderPayload = {
                    order_id: orderId,
                    order_amount: Number(pricing.advance),
                    order_currency: 'INR',
                    customer_details: {
                        customer_id: user._id.toString(),
                        customer_name: name,
                        customer_phone: cleanedPhone.slice(-10),
                        customer_email: user.email || 'customer@zomocook.in'
                    },
                    order_meta: {
                        return_url: `${process.env.BASE_URL || 'https://api.zomocook.in'}/api/payments/verify?order_id={order_id}`
                    },
                    order_note: `Web Commercial Hiring 25% Advance (Plan: ${selectedPlan?.name || 'Basic'})`
                };

                const cfRes = await fetch(`${getCashfreeBaseUrl()}/orders`, {
                    method: 'POST',
                    headers: cfHeaders,
                    body: JSON.stringify(orderPayload)
                });
                const cfData = await cfRes.json();
                if (cfData.payment_session_id) {
                    paymentSessionId = cfData.payment_session_id;

                    const Transaction = require('../models/Transaction');
                    await Transaction.create({
                        type: 'job_post_fee',
                        amount: Number(pricing.advance),
                        status: 'pending',
                        gateway: 'cashfree',
                        orderId: cfData.order_id,
                        paymentSessionId: cfData.payment_session_id,
                        user: user._id,
                        customer: customer._id,
                        relatedJob: createdJobs[0]?._id,
                        description: `Commercial Booking 25% Advance (Web)`
                    });
                }
            } catch (payErr) {
                console.error('Cashfree order generation error for web booking:', payErr);
            }
        }

        const currentCfEnv = ((process.env.CASHFREE_ENV || 'PRODUCTION').toUpperCase() === 'PROD' || (process.env.CASHFREE_ENV || 'PRODUCTION').toUpperCase() === 'PRODUCTION') ? 'PRODUCTION' : 'SANDBOX';

        res.status(201).json({
            success: true,
            message: 'Commercial requirement posted successfully through backend API',
            userId: user._id,
            customerId: customer._id,
            jobs: createdJobs,
            paymentSessionId,
            orderId,
            advanceAmount: pricing?.advance || 0,
            environment: currentCfEnv
        });

    } catch (error) {
        console.error('Error in createCommercialWebJob:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    ...oldExports,
    applyForJob,
    resendJobNotification,
    completePayment,
    createCommercialWebJob
};
