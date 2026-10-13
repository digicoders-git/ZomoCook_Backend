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

const formatJobNotification = (job) => {
    const cityText = job.city ? `in ${job.city}` : '';
    const isDaily = (job.jobCategory === 'daily' || job.bookingType === 'daily' || (job.title && job.title.toLowerCase().includes('daily')));
    const isEvent = (job.jobCategory === 'party' || job.bookingType === 'party' || (job.title && job.title.toLowerCase().includes('party')));

    let title = 'New Chef Job Alert!';
    let message = '';

    if (isDaily && job.staffRequirements && job.staffRequirements.length > 0) {
        title = 'New Daily Job Alert!';
        const rolesWithRates = job.staffRequirements.map(s => {
            const r = s.role || 'Staff';
            const rate = s.ratePerDay || s.rate || '';
            return rate ? `${r} (₹${rate}/Day)` : r;
        });
        const summary = rolesWithRates.slice(0, 2).join(', ') + (rolesWithRates.length > 2 ? ` & ${rolesWithRates.length - 2} more` : '');
        message = `Daily Basis ${cityText}: ${summary}. Tap to view & apply!`;
    } else if (job.commercialStaffList && job.commercialStaffList.length > 0) {
        title = 'New Restaurant / Hotel Job!';
        const rolesWithSal = job.commercialStaffList.map(s => {
            const r = s.role || 'Chef';
            const sal = s.salaryRange || s.salary || '';
            return sal ? `${r} (${sal})` : r;
        });
        const summary = rolesWithSal.slice(0, 2).join(', ') + (rolesWithSal.length > 2 ? ` & ${rolesWithSal.length - 2} more` : '');
        message = `Hotel/Restaurant ${cityText}: ${summary}. Apply now!`;
    } else if (isEvent) {
        title = 'New Party Event Job!';
        const sal = job.salary ? `₹${job.salary}/Day` : (job.salaryRange || '₹2,550/Day');
        message = `Party Chef ${cityText} • Charges: ${sal}. Tap to view & apply!`;
    } else {
        const role = job.jobPosition || job.title || 'Chef / Home Cook';
        const sal = job.salaryRange || job.salary || 'Best in Industry';
        message = `${role} ${cityText} • Salary: ${sal}. Apply now!`;
    }

    return { title, message };
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

        if (typeof jobData.staffRequirements === 'string') {
            try { jobData.staffRequirements = JSON.parse(jobData.staffRequirements); } catch(e) {}
        }
        if (typeof jobData.commercialStaffList === 'string') {
            try { jobData.commercialStaffList = JSON.parse(jobData.commercialStaffList); } catch(e) {}
        }
        if (typeof jobData.partyRequirement === 'string') {
            try { jobData.partyRequirement = JSON.parse(jobData.partyRequirement); } catch(e) {}
        }
        if (typeof jobData.eventDays === 'string') {
            try { jobData.eventDays = JSON.parse(jobData.eventDays); } catch(e) {}
        }
        if (typeof jobData.pricing === 'string') {
            try { jobData.pricing = JSON.parse(jobData.pricing); } catch(e) {}
        }

        // Auto-fill title and descriptions if not provided
        const roleName = jobData.jobPosition || (Array.isArray(jobData.staffRequirements) && jobData.staffRequirements[0]?.role) || jobData.event || 'Cook';
        if (!jobData.title || jobData.title.trim() === '') {
            jobData.title = `${roleName} Requirement${jobData.city ? ` in ${jobData.city}` : ''}`;
        }
        if (!jobData.overview || jobData.overview.trim() === '') {
            jobData.overview = `Looking for ${roleName} in ${jobData.city || 'specified location'}.`;
        }
        if (!jobData.responsibilities || jobData.responsibilities.trim() === '') {
            jobData.responsibilities = `Handle daily cooking, meal preparation, hygiene and kitchen management as required.`;
        }
        if (!jobData.requirements || jobData.requirements.trim() === '') {
            jobData.requirements = `Must be experienced in cooking, reliable, punctual and maintain hygiene standards.`;
        }

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
            const notifData = formatJobNotification(job);
            notificationController.sendNotificationToRole({
                roleName: 'Cook',
                title: notifData.title,
                message: notifData.message,
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
            if (minSalary) query.$expr = { $gte: [{ $convert: { input: { $arrayElemAt: [{ $split: ['$salaryRange', '-'] }, 0] }, to: "int", onError: 0, onNull: 0 } }, parseInt(minSalary)] };
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
            const jobCat = (job.jobCategory || '').toLowerCase();
            const bType = (job.bookingType || '').toLowerCase();
            const jType = (job.jobType || '').toLowerCase();
            const title = (job.title || '').toLowerCase();
            const isDailyOrParty = jobCat === 'daily' || jobCat === 'party' || bType === 'daily' || bType === 'party' || jType.includes('daily') || jType.includes('party') || title.includes('daily') || title.includes('party');

            let assignedCandidates = apps.filter(app => ['Applied', 'Profile Reviewed'].includes(app.status)).length;
            if (isCustomer && isDailyOrParty) {
                // Customer should not see raw applicants count for daily and party jobs (Admin assigned flow)
                assignedCandidates = 0;
            }
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
                appliedCount: isCustomer && isDailyOrParty ? 0 : apps.length,
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

        if (typeof req.body.staffRequirements === 'string') {
            try { req.body.staffRequirements = JSON.parse(req.body.staffRequirements); } catch(e) {}
        }
        if (typeof req.body.commercialStaffList === 'string') {
            try { req.body.commercialStaffList = JSON.parse(req.body.commercialStaffList); } catch(e) {}
        }
        if (typeof req.body.partyRequirement === 'string') {
            try { req.body.partyRequirement = JSON.parse(req.body.partyRequirement); } catch(e) {}
        }
        if (typeof req.body.eventDays === 'string') {
            try { req.body.eventDays = JSON.parse(req.body.eventDays); } catch(e) {}
        }
        if (typeof req.body.pricing === 'string') {
            try { req.body.pricing = JSON.parse(req.body.pricing); } catch(e) {}
        }

        if (req.body.assignedStaff && Array.isArray(req.body.assignedStaff)) {
            req.body.assignedStaff = req.body.assignedStaff.map(s => {
                if (typeof s === 'object' && s !== null) {
                    if (!s.startOtp) s.startOtp = Math.floor(100000 + Math.random() * 900000).toString();
                    if (!s.endOtp) s.endOtp = Math.floor(100000 + Math.random() * 900000).toString();
                }
                return s;
            });
            if (!req.body.startOtp && req.body.assignedStaff[0]?.startOtp) {
                req.body.startOtp = req.body.assignedStaff[0].startOtp;
            }
            if (!req.body.endOtp && req.body.assignedStaff[0]?.endOtp) {
                req.body.endOtp = req.body.assignedStaff[0].endOtp;
            }
        }

        const wasNotAssigned = job.status !== 'Assigned';
        const isNowAssigned = req.body.status === 'Assigned' || (req.body.assignedStaff && Array.isArray(req.body.assignedStaff) && req.body.assignedStaff.length > 0);

        const wasNotPaid = job.paymentStatus !== 'paid';
        const isNowPaid = req.body.paymentStatus === 'paid';

        if (wasNotPaid && isNowPaid) {
            req.body.paymentStatus = 'paid';
            req.body.isActive = true;
            if (job.status === 'hold' || job.status === 'Pending' || req.body.status === 'Pending' || req.body.status === 'hold') {
                req.body.status = 'New';
            }
            req.body.createdAt = new Date();
        }

        job = await Job.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        // Send push notification to all cooks if payment status just transitioned to 'paid'
        if (wasNotPaid && isNowPaid) {
            const txnType = job.jobType === 'daily' ? 'daily_job_advance' : 'job_post_fee';
            const Transaction = require('../models/Transaction');
            const existingTxn = await Transaction.findOne({
                relatedJob: job._id,
                type: txnType,
                status: 'success'
            });

            if (!existingTxn) {
                const adminUser = req.admin || req.user;
                const isCustomer = adminUser && adminUser.constructor && adminUser.constructor.modelName === 'Customer';
                const finalAmount = job.jobType === 'daily' ? (job.advanceAmount || 0) : (job.jobPostFee || 299);
                const txnData = {
                    type: txnType,
                    amount: finalAmount,
                    status: 'success',
                    relatedJob: job._id,
                    razorpayOrderId: 'OFFLINE_' + Date.now(),
                    razorpayPaymentId: 'MANUAL_' + Date.now(),
                    description: job.jobType === 'daily' 
                        ? `Daily job 25% advance marked by: ${adminUser ? adminUser.name || 'Admin' : 'Admin'}`
                        : `Job post fee marked by: ${adminUser ? adminUser.name || 'Admin' : 'Admin'}`
                };
                if (adminUser) {
                    if (isCustomer) {
                        txnData.customer = adminUser._id;
                    } else {
                        txnData.user = adminUser._id;
                    }
                }
                await Transaction.create(txnData).catch(e => console.error('Txn create error:', e));
            }

            // Send push notification to all cooks
            const notificationController = require('./notificationController');
            const notifData = formatJobNotification(job);
            notificationController.sendNotificationToRole({
                roleName: 'Cook',
                title: notifData.title,
                message: notifData.message,
                type: 'job_available',
                relatedId: job._id,
                relatedModel: 'Job',
                actionUrl: '/jobs'
            }).catch(err => console.error('Error sending job post push notification in updateJob:', err));

            // Send push notification to customer / poster that payment is confirmed
            let jobPosterId = job.createdBy;
            let jobPosterModel = job.creatorModel || 'User';
            if (!jobPosterId && job.customer) {
                const Customer = require('../models/Customer');
                const custDoc = await Customer.findById(job.customer);
                if (custDoc) {
                    jobPosterId = custDoc.createdBy || custDoc._id;
                    jobPosterModel = custDoc.creatorModel || 'User';
                }
            }
            if (jobPosterId) {
                notificationController.sendNotificationToUser({
                    userId: jobPosterId,
                    userModel: jobPosterModel,
                    title: '✅ Payment Confirmed & Job Live!',
                    message: `Payment confirmed for "${job.title || job.jobCode || 'requirement'}". Your job is now active and verified cooks are being assigned!`,
                    type: 'job_payment_confirmed',
                    relatedId: job._id,
                    relatedModel: 'Job',
                    actionUrl: '/bookings'
                }).catch(err => console.error('Error sending customer payment notification in updateJob:', err));
            }

            if (job.creatorModel === 'User') {
                const User = require('../models/User');
                const user = await User.findById(job.createdBy);
                if (user) {
                    user.jobsPostedInCurrentPlan = (user.jobsPostedInCurrentPlan || 0) + 1;
                    await user.save().catch(e => console.error('Error updating user jobs count:', e));
                }
            }
        }

        // Send push notification to customer when chef/staff is assigned
        if (wasNotAssigned && isNowAssigned) {
            let jobPosterId = job.createdBy;
            let jobPosterModel = job.creatorModel || 'User';
            if (!jobPosterId && job.customer) {
                const Customer = require('../models/Customer');
                const custDoc = await Customer.findById(job.customer);
                if (custDoc) {
                    jobPosterId = custDoc.createdBy || custDoc._id;
                    jobPosterModel = custDoc.creatorModel || 'User';
                }
            }
            if (jobPosterId) {
                const notificationController = require('./notificationController');
                notificationController.sendNotificationToUser({
                    userId: jobPosterId,
                    userModel: jobPosterModel,
                    title: '👨‍🍳 Chef Assigned!',
                    message: `Chef / Staff has been assigned for your booking "${job.title || job.jobCode || 'requirement'}". You can now view chef details and share Start OTP in your app.`,
                    type: 'candidate_assigned',
                    relatedId: job._id,
                    relatedModel: 'Job',
                    actionUrl: '/bookings'
                }).catch(err => console.error('Error sending chef assigned push notification to customer:', err));
            }
        }

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
        if (job.createdBy || job.customer) {
            let jobPosterId = job.createdBy;
            let jobPosterModel = job.creatorModel || 'User';
            if (!jobPosterId && job.customer) {
                const Customer = require('../models/Customer');
                const custDoc = await Customer.findById(job.customer);
                if (custDoc) {
                    jobPosterId = custDoc.createdBy || custDoc._id;
                    jobPosterModel = custDoc.creatorModel || 'User';
                }
            }

            if (jobPosterId) {
                const notificationController = require('./notificationController');
                if (status === 'Assigned') {
                    notificationController.sendNotificationToUser({
                        userId: jobPosterId,
                        userModel: jobPosterModel,
                        title: '👨‍🍳 Chef Assigned!',
                        message: `Chef / Staff has been assigned for your booking "${job.title || job.jobCode || 'requirement'}". You can now view chef details and share Start OTP in your app.`,
                        type: 'candidate_assigned',
                        relatedId: job._id,
                        relatedModel: 'Job',
                        actionUrl: '/bookings'
                    }).catch(err => console.error('Error sending chef assigned push notification to customer:', err));
                } else {
                    const statusEmoji = {
                        'Active': '✅', 'New': '🆕', 'Urgent': '🚨', 'Open': '🔓',
                        'In Progress': '🔄', 'Inactive': '⏸️', 'Cancelled': '❌',
                        'Expired': '⏰', 'Closed': '🔒', 'Hold': '⏳'
                    };
                    const emoji = statusEmoji[status] || '📋';
                    notificationController.sendNotificationToUser({
                        userId: jobPosterId,
                        userModel: jobPosterModel,
                        title: `${emoji} Job Status Updated`,
                        message: `Your job "${job.title}" status has been changed to "${status}".`,
                        type: 'job_status',
                        relatedId: job._id,
                        relatedModel: 'Job',
                        actionUrl: '/jobs'
                    }).catch(err => console.error('Error sending status update notification:', err));
                }
            }
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

        const rawRole = req.body.appliedRole || req.body.role || '';
        const targetRole = rawRole.replace(/\s*\(daily basis\)/i, '').trim();

        const canApply = candidate.profileVerification?.canApplyForJobs || 
                         candidate.profileVerification?.status === 'approved' || 
                         candidate.kycStatus === 'approved';
        if (!canApply) {
            return res.status(403).json({
                success: false,
                message: 'Your profile is pending admin approval. You cannot apply for jobs until your profile is approved.',
                profileStatus: candidate.profileVerification?.status || 'pending_approval',
                requiresApproval: true
            });
        }

        const existingAppQuery = { job: jobId, candidate: candidate._id };
        if (targetRole) {
            const escapedRole = targetRole.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            existingAppQuery.$or = [
                { appliedRole: targetRole },
                { appliedRole: `${targetRole} (Daily Basis)` },
                { appliedRole: new RegExp(`^${escapedRole}`, 'i') }
            ];
        }
        const existingApp = await Application.findOne(existingAppQuery);
        if (existingApp) {
            return res.status(400).json({ success: false, message: `You have already applied for this job${targetRole ? ` as ${targetRole}` : ''}` });
        }

        const application = await Application.create({
            job: jobId,
            candidate: candidate._id,
            customer: job.createdBy || job.customer,
            status: 'Applied',
            appliedRole: targetRole,
            appliedDate: new Date()
        });

        // Determine if Daily Basis or Chef for Party job (admin assignment flow, no applicant notification to customer)
        const jobCat = (job.jobCategory || '').toLowerCase();
        const bType = (job.bookingType || '').toLowerCase();
        const jType = (job.jobType || '').toLowerCase();
        const jTitle = (job.title || '').toLowerCase();
        const isDailyOrParty = jobCat === 'daily' || jobCat === 'party' || 
                               bType === 'daily' || bType === 'party' || 
                               jType.includes('daily') || jType.includes('party') || 
                               jTitle.includes('daily') || jTitle.includes('party') ||
                               Boolean(job.partyRequirement && Object.keys(job.partyRequirement).length > 0);

        // Send push notification specifically to the user who posted the job ONLY if not daily/party
        let jobPosterId = job.createdBy;
        let jobPosterModel = job.creatorModel || 'User';

        if (!jobPosterId && job.customer) {
            const Customer = require('../models/Customer');
            const custDoc = await Customer.findById(job.customer);
            if (custDoc) {
                jobPosterId = custDoc.createdBy || custDoc._id;
                jobPosterModel = custDoc.creatorModel || 'User';
            }
        }

        if (jobPosterId && !isDailyOrParty) {
            const notificationController = require('./notificationController');
            notificationController.sendNotificationToUser({
                userId: jobPosterId,
                userModel: jobPosterModel,
                title: '📝 New Job Application',
                message: `${candidate.name || 'A candidate'} has applied for your job "${job.title || 'Job'}".`,
                type: 'application_status',
                relatedId: application._id,
                relatedModel: 'Application',
                actionUrl: '/applications'
            }).catch(err => console.error('Error sending job apply push notification:', err));
        }

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

        const notifData = formatJobNotification(job);
        
        await notificationController.sendNotificationToRole({
            roleName: 'Cook',
            title: notifData.title,
            message: notifData.message,
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
        const notifData = formatJobNotification(job);
        notificationController.sendNotificationToRole({
            roleName: 'Cook',
            title: notifData.title,
            message: notifData.message,
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
        const name = req.body.name || req.body.contactName || req.body.fullName || 'Customer';
        const rawPhone = req.body.phone || req.body.contactPhone || req.body.mobile || '';
        const email = req.body.email || req.body.contactEmail || '';
        const address = req.body.address || req.body.outletAddress || req.body.venueAddress || '';
        const city = req.body.city || 'Lucknow';
        const outletName = req.body.outletName || req.body.restaurantName || '';
        const familyMembers = req.body.familyMembers;
        const message = req.body.message || '';
        const staffList = req.body.staffRequirements || req.body.staffList || [];
        const selectedPlan = req.body.selectedPlan;
        const rawPricing = req.body.pricing || req.body.billingSummary || {};
        const pricing = {
            staffCharges: rawPricing.staffCharges || rawPricing.staffChargesTotal || rawPricing.totalPrice || 0,
            gst: rawPricing.gst || 0,
            platformFee: rawPricing.platformFee || 0,
            total: rawPricing.total || rawPricing.totalAmount || rawPricing.totalPrice || 0,
            advance: rawPricing.advance || rawPricing.advancePayable || rawPricing.advanceAmount || rawPricing.advancePay || 0,
            duePay: rawPricing.duePay || rawPricing.dueAmount || ((rawPricing.total || rawPricing.totalPrice || 0) - (rawPricing.advance || rawPricing.advancePay || 0)),
            perDayPrice: rawPricing.perDayPrice || 0,
            numberOfDays: rawPricing.numberOfDays || 0
        };

        if (!rawPhone) {
            return res.status(400).json({ success: false, message: 'Phone number is required' });
        }

        const User = require('../models/User');
        const Customer = require('../models/Customer');
        const Role = require('../models/Role');
        const cleanedPhone = rawPhone.toString().trim();

        // 1. Find or create User with this phone number (check JWT auth token or userId first if available)
        let loggedInUserId = req.body.userId || req.body.createdBy || null;
        if (!loggedInUserId && req.headers && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            try {
                const jwt = require('jsonwebtoken');
                const token = req.headers.authorization.split(' ')[1];
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
                if (decoded && (decoded.id || decoded._id)) {
                    loggedInUserId = decoded.id || decoded._id;
                }
            } catch (jwtErr) {}
        }

        let user = null;
        if (loggedInUserId) {
            user = await User.findById(loggedInUserId);
        }

        if (!user) {
            user = await User.findOne({
                $or: [
                    { phone: cleanedPhone },
                    { phone: `+91${cleanedPhone}` },
                    { phone: cleanedPhone.replace('+91', '') }
                ]
            });
        }

        let customerRole = await Role.findOne({ name: { $regex: /^customer$/i } });
        if (!customerRole) {
            customerRole = await Role.create({ name: 'Customer' });
        }

        if (!user) {
            user = await User.create({
                name: name,
                phone: cleanedPhone,
                email: email || '',
                address: address || '',
                outletName: outletName || '',
                propertyCategory: 'Hotel/Restaurant',
                status: 'Active',
                role: customerRole._id
            });
        } else {
            user.name = name || user.name;
            if (email) user.email = email;
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
                email: email || '',
                contactAddress: address || '',
                propertyCategory: 'Hotel/Restaurant',
                customerStatus: 'running',
                accountStatus: 'active',
                createdBy: user._id,
                creatorModel: 'User'
            });
        } else {
            customer.name = name || customer.name;
            if (email) customer.email = email;
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

        // Determine if this is a Party Chef booking
        const isParty = req.body.bookingType === 'party' || 
                        req.body.jobCategory === 'party' || 
                        req.body.hiringType === 'Chef for Party' || 
                        (req.body.hiringType && req.body.hiringType.toLowerCase().includes('party')) ||
                        (req.body.partyRequirement && Object.keys(req.body.partyRequirement).length > 0) ||
                        (req.body.eventDates && req.body.eventDates.length > 0);

        // Determine if this is a Daily Basis Staff booking
        const isDaily = req.body.jobCategory === 'daily' || 
                        req.body.category === 'daily' || 
                        req.body.bookingType === 'daily' ||
                        req.body.hiringType === 'Daily Basis Staff' || 
                        (req.body.hiringType && req.body.hiringType.toLowerCase().includes('daily'));

        // Determine category: 'hotel' | 'home' | 'daily' | 'party'
        let targetCategory = req.body.jobCategory;
        if (!targetCategory) {
            if (isParty) targetCategory = 'party';
            else if (isDaily) targetCategory = 'daily';
            else if (req.body.category === 'home' || req.body.category === 'domestic') targetCategory = 'home';
            else targetCategory = 'hotel';
        }

        const rawDates = req.body.eventDates || [];
        const rawAddons = req.body.addOns || req.body.addons || {};

        let computedGuests = Number(req.body.noOfGuests) || 0;
        if (!computedGuests && rawDates.length > 0) {
            rawDates.forEach(d => {
                (d.meals || []).forEach(m => {
                    const g = Number(m.guests || 0) || (Number(m.vegGuests || 0) + Number(m.nonVegGuests || 0));
                    computedGuests += g;
                });
            });
        }

        // Standardize partyRequirement from either web format or Flutter app format
        let partyRequirement = req.body.partyRequirement;
        if (!partyRequirement && isParty) {
            partyRequirement = {
                eventType: req.body.occasion || req.body.event || 'Party Event',
                guestCount: computedGuests || 30,
                datesCount: rawDates.length || 1,
                dates: rawDates.map(d => ({
                    date: d.date || '',
                    occasion: d.occasion || req.body.occasion || 'Party Event',
                    eventType: d.eventType || d.occasion || req.body.occasion || 'Party Event',
                    meals: (d.meals || []).map(m => {
                        const dishList = Array.isArray(m.selectedMenu) && m.selectedMenu.length > 0
                            ? m.selectedMenu
                            : (Array.isArray(m.dishes) ? m.dishes : (Array.isArray(m.menu) ? m.menu : []));
                        return {
                            mealType: m.mealType || m.name || 'Meal',
                            guests: m.guests || (Number(m.vegGuests || 0) + Number(m.nonVegGuests || 0)) || 0,
                            servingTime: m.servingTime || '',
                            foodPreference: m.foodPreference || '',
                            menuChoice: m.menuChoice || 'now',
                            categoryDishCounts: m.categoryDishCounts || {},
                            totalDishes: m.totalDishes || dishList.length || 0,
                            selectedCuisines: m.selectedCuisines || [],
                            selectedMenu: dishList,
                            dishes: dishList,
                            notes: m.notes || ''
                        };
                    })
                }))
            };
        } else if (partyRequirement && isParty && Array.isArray(partyRequirement.dates)) {
            partyRequirement.dates = partyRequirement.dates.map(d => ({
                ...d,
                meals: (d.meals || []).map(m => {
                    const dishList = Array.isArray(m.selectedMenu) && m.selectedMenu.length > 0
                        ? m.selectedMenu
                        : (Array.isArray(m.dishes) ? m.dishes : (Array.isArray(m.menu) ? m.menu : []));
                    return {
                        ...m,
                        selectedMenu: dishList,
                        dishes: dishList
                    };
                })
            }));
        }

        // Extract all selected dishes across all meals
        const allDishes = [];
        const sourceDates = (partyRequirement && partyRequirement.dates) ? partyRequirement.dates : rawDates;
        sourceDates.forEach(d => {
            (d.meals || []).forEach(m => {
                const list = m.selectedMenu || m.dishes || [];
                list.forEach(dish => {
                    const dishName = typeof dish === 'string' ? dish : (dish.name || dish.dishName || '');
                    if (dishName && !allDishes.includes(dishName)) {
                        allDishes.push(dishName);
                    }
                });
            });
        });
        const flattenedMenuDetails = req.body.menuDetails || allDishes.join(', ');
        if (partyRequirement) {
            partyRequirement.menuDetails = flattenedMenuDetails;
            partyRequirement.addOns = rawAddons;
            partyRequirement.addons = rawAddons;
            if (!partyRequirement.guestCount) {
                partyRequirement.guestCount = computedGuests || 30;
            }
        }

        // Resolve Event Date: Use explicit dateOfEvent or derive from staff requirements / event dates
        let resolvedDateOfEvent = req.body.dateOfEvent ? new Date(req.body.dateOfEvent) : undefined;
        let startDates = [];
        let endDates = [];
        if (req.body.startDate) startDates.push(req.body.startDate);
        if (req.body.endDate) endDates.push(req.body.endDate);

        if (staffList && staffList.length > 0) {
            startDates.push(...staffList.map(s => s.startDate).filter(Boolean));
            endDates.push(...staffList.map(s => s.endDate || s.startDate).filter(Boolean));
        }

        if (rawDates.length > 0) {
            const dateStrings = rawDates.map(d => d.date).filter(Boolean).sort();
            if (dateStrings.length > 0) {
                startDates.push(dateStrings[0]);
                endDates.push(dateStrings[dateStrings.length - 1]);
                if (!resolvedDateOfEvent) {
                    resolvedDateOfEvent = new Date(dateStrings[0]);
                }
            }
        }
        startDates = startDates.sort();
        endDates = endDates.sort();
        if (!resolvedDateOfEvent && startDates.length > 0) {
            resolvedDateOfEvent = new Date(startDates[0]);
        }

        // Resolve staff requirements
        let resolvedStaffRequirements = undefined;
        if (staffList && staffList.length > 0) {
            resolvedStaffRequirements = staffList.map(s => {
                const days = Number(s.days || s.noOfDays || 1);
                const sDate = s.startDate || (startDates[0] || '');
                let eDate = s.endDate || sDate;
                if (!s.endDate && sDate && days > 1) {
                    try {
                        const d = new Date(sDate);
                        d.setDate(d.getDate() + (days - 1));
                        eDate = d.toISOString().split('T')[0];
                    } catch(e) {}
                }
                return {
                    role: s.role || s.category || s.staffCategory || 'Staff',
                    genderPref: s.genderPreference || s.genderPref || 'Any Gender',
                    count: Number(s.count || s.noOfStaff || 1),
                    ratePerDay: Number(s.ratePerDay || s.salary || 0),
                    days: days,
                    startDate: sDate,
                    endDate: eDate,
                    startTime: s.startTime || (s.timing ? s.timing.split('–')[0]?.trim() : ''),
                    endTime: s.endTime || (s.timing ? s.timing.split('–')[1]?.trim() : '')
                };
            });
        } else if (isParty) {
            const partyDaysCount = rawDates.length || 1;
            const sDate = startDates.length > 0 ? startDates[0] : (resolvedDateOfEvent ? resolvedDateOfEvent.toISOString().split('T')[0] : '');
            const eDate = endDates.length > 0 ? endDates[endDates.length - 1] : sDate;
            const chefFee = Number(pricing?.staffCharges || (1999 * partyDaysCount));
            resolvedStaffRequirements = [{
                role: 'Chef for Party',
                genderPref: 'Any Gender',
                count: 1,
                ratePerDay: Math.round(chefFee / partyDaysCount),
                days: partyDaysCount,
                startDate: sDate,
                endDate: eDate,
                startTime: 'Event Time',
                endTime: 'Completion'
            }];
        }

        // 3. Create Jobs: Exactly ONE job containing all staff requirements
        const items = [(staffList && staffList.length > 0) ? staffList[0] : {
            category: isParty ? 'Chef for Party' : 'Chef',
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

            const occasionName = req.body.occasion || req.body.event || partyRequirement?.eventType || '';
            const isGenericOccasion = !occasionName || ['party / event', 'event', 'party'].includes(occasionName.toLowerCase());
            const rolesListSummary = (staffList && staffList.length > 0)
                ? staffList.map(s => `${s.role || s.category || 'Staff'} × ${s.count || 1}`).join(', ')
                : '';

            const defaultTitle = isParty
                ? (!isGenericOccasion ? `${occasionName} - Chef for Party` : `Chef for Party Booking for ${name} (${partyRequirement?.datesCount || 1} Day Event)`)
                : (targetCategory === 'daily'
                    ? (req.body.title || (rolesListSummary ? `Daily Staff Requirement (${rolesListSummary})` : `Daily Staff Requirement at ${outletName || name}`))
                    : (targetCategory === 'home' 
                        ? `${item.category || 'Home Cook'} Required at ${outletName || name}`
                        : `${item.category || 'Hospitality Staff'} Required at ${outletName || name}`));

            const jobTitle = req.body.title || defaultTitle;
            const partyDetailsDesc = isParty && partyRequirement
                ? `Party Details: Dates Count: ${partyRequirement.datesCount || 1}, City: ${req.body.city || city || address}, Amount: ₹${pricing?.total || pricing?.advance || 0}. Payment: ${partyRequirement.paymentMethod || 'Online'}`
                : '';
            const jobDesc = isParty
                ? `Chef for Party requirement booked by ${name} (+91 ${cleanedPhone}). Location: ${address}. ${partyDetailsDesc}`
                : (targetCategory === 'daily'
                    ? `Daily Staff requirement (${rolesListSummary || 'Staff'}). Location: ${address || 'Lucknow'}. Notes: ${message || 'On time reporting required'}.`
                    : `Hiring ${item.count || 1} ${item.category || 'Staff'}. Salary ₹${item.salary || 'Negotiable'}. Food: ${item.food || 'Available'}, Accommodation: ${item.accommodation || 'Not Required'}. Plan: ${selectedPlan?.name || 'Basic'}. Location: ${address || 'On Request'}. ${message ? `Notes: ${message}` : ''}`);

            const salaryRangeValue = (() => {
                if (isParty) {
                    const totalEst = pricing?.total || pricing?.staffCharges || 1999;
                    const days = rawDates.length || 1;
                    return days > 1 ? `₹${Math.round(totalEst / days)}/day (Total: ₹${totalEst})` : `₹${totalEst} (Party Event)`;
                }
                if (targetCategory === 'daily' && staffList && staffList.length > 0) {
                    const rates = staffList.map(s => Number(s.ratePerDay || s.rate || s.salary || 0)).filter(r => r > 0);
                    if (rates.length > 0) {
                        const minR = Math.min(...rates);
                        const maxR = Math.max(...rates);
                        return minR === maxR ? `₹${minR}/day` : `₹${minR} - ₹${maxR}/day`;
                    }
                }
                return item.salary ? `₹${item.salary}${targetCategory === 'daily' ? '' : '/month'}` : (targetCategory === 'daily' ? 'Fixed Charges / Day' : '₹20000 - ₹35000');
            })();

            const newJob = await Job.create({
                jobCategory: isParty ? 'party' : targetCategory,
                jobCode,
                title: jobTitle,
                customer: customer._id,
                propertyCategory: isParty ? 'Event/Party' : (targetCategory === 'daily' ? 'Event/Party' : (targetCategory === 'home' ? 'Residence/Home' : 'Hotel/Restaurant')),
                state: 'India',
                city: req.body.city || city || 'Lucknow',
                address: address || '',
                venueAddress: req.body.venueAddress || address || '',
                email: email || (customer && customer.email) || (user && user.email) || '',
                outletName: outletName || '',
                hiringPurpose: req.body.hiringPurpose ? req.body.hiringPurpose.toLowerCase() : ((req.body.bookingType || '').toLowerCase() === 'commercial' ? 'commercial' : 'domestic'),
                bookingType: isParty ? 'party' : (['regular', 'daily'].includes((req.body.bookingType || '').toLowerCase()) ? req.body.bookingType.toLowerCase() : (targetCategory === 'daily' ? 'daily' : 'regular')),
                overview: jobDesc,
                responsibilities: `Work as ${item.category || item.role || (isParty ? 'Chef for Party' : 'Staff')} for ${name}.`,
                requirements: `Qualified and verified ${item.category || item.role || (isParty ? 'Party Chef' : 'Candidate')}.`,
                jobType: isParty ? 'Party Event' : (targetCategory === 'daily' ? 'Daily Pay' : 'Full Time'),
                jobPosition: isParty ? 'Chef for Party' : (item.category || item.role || 'Chef'),
                salaryRange: salaryRangeValue,
                packageOrGuestOrVacancy: isParty ? `${computedGuests || 30} Guests` : `${item.count || 1} Staff`,
                event: req.body.occasion || req.body.event || (targetCategory === 'daily' || isParty ? 'Party / Event' : undefined),
                noOfGuests: (computedGuests > 0 ? String(computedGuests) : (req.body.noOfGuests ? String(req.body.noOfGuests) : undefined)),
                staffRequirements: resolvedStaffRequirements,
                eventDays: (req.body.eventDates && req.body.eventDates.length > 0) ? req.body.eventDates : (partyRequirement?.dates || rawDates),
                partyRequirement: partyRequirement || undefined,
                addOns: rawAddons,
                addons: rawAddons,
                appliedCoupon: req.body.appliedCoupon || '',
                menuDetails: flattenedMenuDetails,
                pricing: pricing || undefined,
                dateOfEvent: resolvedDateOfEvent,
                startDate: req.body.startDate || (startDates.length > 0 ? startDates[0] : (resolvedDateOfEvent ? resolvedDateOfEvent.toISOString().split('T')[0] : undefined)),
                endDate: req.body.endDate || (endDates.length > 0 ? endDates[endDates.length - 1] : undefined),
                foodPreference: req.body.foodPreference || (rawDates[0]?.meals[0]?.foodPreference) || item.food || 'Available',
                status: 'New',
                isActive: true,
                createdBy: user._id,
                creatorModel: 'User',
                paymentStatus: 'pending',
                advanceAmount: pricing?.advance || pricing?.advanceAmount || 0,
                totalAmount: pricing?.total || pricing?.totalAmount || 0,
                leadManager: assignedManagerId,
                source: req.body.source || (req.headers.authorization ? 'app' : 'web')
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

// ─── OTP-Based Job Lifecycle APIs ────────────────────────────────────────────

/**
 * @desc    Admin assigns staff to a daily/party job — generates startOtp for cook
 * @route   POST /api/jobs/:id/assign-staff
 * @access  Private (Admin)
 */
const assignStaffToJob = async (req, res) => {
    try {
        const job = await Job.findById(req.params.id);
        if (!job) return res.status(404).json({ success: false, message: 'Job not found' });

        const { candidateId, name, role, phone, experience } = req.body;
        if (!candidateId || !name) {
            return res.status(400).json({ success: false, message: 'candidateId and name are required' });
        }

        // Generate 6-digit OTP for starting the job
        const startOtp = Math.floor(100000 + Math.random() * 900000).toString();
        // Generate 6-digit OTP for completing the job (customer gets this)
        const endOtp = Math.floor(100000 + Math.random() * 900000).toString();

        // Check if already assigned
        const existing = job.assignedStaff.find(s => s.candidate?.toString() === candidateId);
        if (existing) {
            return res.status(400).json({ success: false, message: 'This candidate is already assigned to this job' });
        }

        job.assignedStaff.push({
            candidate: candidateId,
            name,
            role: role || 'Staff',
            phone: phone || '',
            experience: experience || '',
            startOtp,
            endOtp,
            status: 'Assigned'
        });

        job.status = 'Assigned';

        // Store job-level startOtp & endOtp for customer to share with cook
        if (!job.startOtp) job.startOtp = startOtp;
        if (!job.endOtp) job.endOtp = endOtp;

        await job.save();

        // Sync or create Application document with status 'Assigned' so it appears in Cook's bookings
        try {
            const Application = require('../models/Application');
            let appDoc = await Application.findOne({ job: job._id, candidate: candidateId });
            if (appDoc) {
                appDoc.status = 'Assigned';
                await appDoc.save();
            } else {
                await Application.create({
                    job: job._id,
                    candidate: candidateId,
                    customer: job.customer || job.createdBy,
                    status: 'Assigned',
                    appliedDate: new Date()
                });
            }
        } catch (appErr) {
            console.error('Application sync error in assignStaffToJob:', appErr.message);
        }

        // Send notifications
        try {
            const notificationController = require('./notificationController');
            // Notify cook with Start OTP
            await notificationController.sendNotificationToUser({
                userId: candidateId,
                userModel: 'Candidate',
                title: '🎉 You are Assigned!',
                message: `You have been assigned as ${role || 'Staff'} for "${job.title}" in ${job.city || 'your area'}. Your Start OTP: ${startOtp}`,
                type: 'job_assigned',
                relatedId: job._id,
                relatedModel: 'Job',
                actionUrl: '/bookings'
            }).catch(() => {});

            // Also notify customer about assignment with Start & End OTP
            let custUserId = job.createdBy;
            let custUserModel = job.creatorModel || 'User';
            if (job.customer) {
                const Customer = require('../models/Customer');
                const custDoc = await Customer.findById(job.customer).populate('createdBy');
                if (custDoc) {
                    custUserId = custDoc.createdBy || custDoc._id;
                    custUserModel = custDoc.creatorModel || 'User';
                }
            }
            if (custUserId) {
                await notificationController.sendNotificationToUser({
                    userId: custUserId,
                    userModel: custUserModel,
                    title: '👨‍🍳 Staff Assigned!',
                    message: `${name} has been assigned as ${role || 'Staff'} for "${job.title}". Start OTP: ${startOtp}, End OTP: ${endOtp}.`,
                    type: 'job_assigned',
                    relatedId: job._id,
                    relatedModel: 'Job',
                    actionUrl: '/bookings'
                }).catch(() => {});
            }
        } catch (notifErr) {
            console.error('Notification error in assignStaffToJob:', notifErr.message);
        }

        res.status(200).json({
            success: true,
            message: 'Staff assigned successfully',
            assignedStaff: job.assignedStaff,
            startOtp,
            endOtp
        });
    } catch (error) {
        console.error('Error in assignStaffToJob:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Cook enters startOtp to mark job as Started
 * @route   POST /api/jobs/:id/start-job
 * @access  Private (Cook/Candidate)
 */
const startJobWithOtp = async (req, res) => {
    try {
        const { otp, candidateId } = req.body;
        if (!otp) return res.status(400).json({ success: false, message: 'OTP is required' });

        const enteredOtp = otp.toString().trim();
        const job = await Job.findById(req.params.id);
        if (!job) return res.status(404).json({ success: false, message: 'Job not found' });

        // Collect possible candidate IDs (candidateId from body, req.user._id, req.admin._id)
        const possibleCandIds = [];
        if (candidateId) possibleCandIds.push(candidateId.toString());
        if (req.user?._id) possibleCandIds.push(req.user._id.toString());
        if (req.admin?._id) possibleCandIds.push(req.admin._id.toString());

        try {
            const Candidate = require('../models/Candidate');
            const cDocs = await Candidate.find({
                $or: [
                    { _id: { $in: possibleCandIds.filter(id => id.match(/^[0-9a-fA-F]{24}$/)) } },
                    { createdBy: { $in: possibleCandIds.filter(id => id.match(/^[0-9a-fA-F]{24}$/)) } }
                ]
            }).select('_id createdBy');
            cDocs.forEach(c => {
                possibleCandIds.push(c._id.toString());
                if (c.createdBy) possibleCandIds.push(c.createdBy.toString());
            });
        } catch (_) {}

        // Find the assigned staff entry for this candidate and OTP
        let staffEntry = job.assignedStaff.find(s => {
            const candMatch = possibleCandIds.length > 0
                ? possibleCandIds.includes(s.candidate?.toString())
                : true;
            return candMatch && s.startOtp?.toString().trim() === enteredOtp && (s.status === 'Assigned' || !s.status);
        });

        // Fallback: match by OTP among assigned staff
        if (!staffEntry) {
            staffEntry = job.assignedStaff.find(s => 
                s.startOtp?.toString().trim() === enteredOtp && (s.status === 'Assigned' || !s.status)
            );
        }

        // Job-level fallback
        if (!staffEntry && job.startOtp && job.startOtp.toString().trim() === enteredOtp) {
            staffEntry = job.assignedStaff.find(s => s.status === 'Assigned') || job.assignedStaff[0];
        }

        if (!staffEntry) {
            return res.status(400).json({ success: false, message: 'Invalid OTP or job not in Assigned state' });
        }

        staffEntry.status = 'Started';
        staffEntry.startedAt = new Date();

        // Check if all staff have started
        const allStarted = job.assignedStaff.every(s => s.status === 'Started' || s.status === 'Completed');
        if (allStarted || job.assignedStaff.length === 1) {
            job.status = 'In Progress';
            job.jobStartedAt = new Date();
        }

        await job.save();

        // Update Application status to Started
        try {
            const Application = require('../models/Application');
            await Application.updateMany(
                {
                    job: job._id,
                    $or: [
                        { candidate: staffEntry.candidate },
                        { candidate: { $in: possibleCandIds.filter(id => id.match(/^[0-9a-fA-F]{24}$/)) } }
                    ]
                },
                { status: 'Started' }
            );
        } catch (appErr) {
            console.error('Application status update error on start:', appErr.message);
        }

        // Notify customer that job has started
        try {
            const notificationController = require('./notificationController');
            let custUserId = job.createdBy;
            let custUserModel = job.creatorModel || 'User';
            if (job.customer) {
                const Customer = require('../models/Customer');
                const custDoc = await Customer.findById(job.customer);
                if (custDoc) {
                    custUserId = custDoc.createdBy || custDoc._id;
                    custUserModel = custDoc.creatorModel || 'User';
                }
            }
            if (custUserId) {
                await notificationController.sendNotificationToUser({
                    userId: custUserId,
                    userModel: custUserModel,
                    title: '🚀 Job Started!',
                    message: `${staffEntry.name} has started working on "${job.title}". End OTP: ${staffEntry.endOtp}`,
                    type: 'job_started',
                    relatedId: job._id,
                    relatedModel: 'Job',
                    actionUrl: '/bookings'
                }).catch(() => {});
            }
        } catch (e) { console.error('Notify error:', e.message); }

        res.status(200).json({
            success: true,
            message: 'Job started successfully',
            jobStatus: job.status,
            startedAt: staffEntry.startedAt,
            endOtp: staffEntry.endOtp
        });
    } catch (error) {
        console.error('Error in startJobWithOtp:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Cook enters endOtp (given by customer) to mark job as Completed
 * @route   POST /api/jobs/:id/complete-job
 * @access  Private (Cook/Candidate)
 */
const completeJobWithOtp = async (req, res) => {
    try {
        const { otp, candidateId } = req.body;
        if (!otp) return res.status(400).json({ success: false, message: 'OTP is required' });

        const enteredOtp = otp.toString().trim();
        const job = await Job.findById(req.params.id);
        if (!job) return res.status(404).json({ success: false, message: 'Job not found' });

        // Collect possible candidate IDs
        const possibleCandIds = [];
        if (candidateId) possibleCandIds.push(candidateId.toString());
        if (req.user?._id) possibleCandIds.push(req.user._id.toString());
        if (req.admin?._id) possibleCandIds.push(req.admin._id.toString());

        try {
            const Candidate = require('../models/Candidate');
            const cDocs = await Candidate.find({
                $or: [
                    { _id: { $in: possibleCandIds.filter(id => id.match(/^[0-9a-fA-F]{24}$/)) } },
                    { createdBy: { $in: possibleCandIds.filter(id => id.match(/^[0-9a-fA-F]{24}$/)) } }
                ]
            }).select('_id createdBy');
            cDocs.forEach(c => {
                possibleCandIds.push(c._id.toString());
                if (c.createdBy) possibleCandIds.push(c.createdBy.toString());
            });
        } catch (_) {}

        // Find the started staff entry
        let staffEntry = job.assignedStaff.find(s => {
            const candMatch = possibleCandIds.length > 0
                ? possibleCandIds.includes(s.candidate?.toString())
                : true;
            return candMatch && s.endOtp?.toString().trim() === enteredOtp && s.status === 'Started';
        });

        // Fallback: match by endOtp among started staff
        if (!staffEntry) {
            staffEntry = job.assignedStaff.find(s => 
                s.endOtp?.toString().trim() === enteredOtp && s.status === 'Started'
            );
        }

        // Job-level fallback
        if (!staffEntry && job.endOtp && job.endOtp.toString().trim() === enteredOtp) {
            staffEntry = job.assignedStaff.find(s => s.status === 'Started') || job.assignedStaff[0];
        }

        if (!staffEntry) {
            return res.status(400).json({ success: false, message: 'Invalid OTP or job has not been started yet' });
        }

        staffEntry.status = 'Completed';
        staffEntry.completedAt = new Date();

        // Check if all staff completed
        const allCompleted = job.assignedStaff.every(s => s.status === 'Completed');
        if (allCompleted) {
            job.status = 'Closed';
            job.jobCompletedAt = new Date();
        }

        await job.save();

        // Update Application status to Completed
        try {
            const Application = require('../models/Application');
            await Application.updateMany(
                {
                    job: job._id,
                    $or: [
                        { candidate: staffEntry.candidate },
                        { candidate: { $in: possibleCandIds.filter(id => id.match(/^[0-9a-fA-F]{24}$/)) } }
                    ]
                },
                { status: 'Completed' }
            );
        } catch (appErr) {
            console.error('Application status update error on complete:', appErr.message);
        }

        // Notify customer about completion
        try {
            const notificationController = require('./notificationController');
            let custUserId = job.createdBy;
            let custUserModel = job.creatorModel || 'User';
            if (job.customer) {
                const Customer = require('../models/Customer');
                const custDoc = await Customer.findById(job.customer);
                if (custDoc) {
                    custUserId = custDoc.createdBy || custDoc._id;
                    custUserModel = custDoc.creatorModel || 'User';
                }
            }
            if (custUserId) {
                await notificationController.sendNotificationToUser({
                    userId: custUserId,
                    userModel: custUserModel,
                    title: '✅ Job Completed!',
                    message: `${staffEntry.name} has completed the job "${job.title}". Thank you for using ZomoCook!`,
                    type: 'job_completed',
                    relatedId: job._id,
                    relatedModel: 'Job',
                    actionUrl: '/bookings'
                }).catch(() => {});
            }
        } catch (e) { console.error('Notify error:', e.message); }

        res.status(200).json({
            success: true,
            message: 'Job completed successfully',
            jobStatus: job.status,
            completedAt: staffEntry.completedAt
        });
    } catch (error) {
        console.error('Error in completeJobWithOtp:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get assigned staff list for a job (cook can also fetch own assignment)
 * @route   GET /api/jobs/:id/assigned-staff
 * @access  Private
 */
const getAssignedStaff = async (req, res) => {
    try {
        const job = await Job.findById(req.params.id)
            .populate('assignedStaff.candidate', 'name phone profilePhoto experience')
            .populate('customer', 'name outletName phone');

        if (!job) return res.status(404).json({ success: false, message: 'Job not found' });

        res.status(200).json({
            success: true,
            job: {
                _id: job._id,
                title: job.title,
                status: job.status,
                city: job.city,
                jobStartedAt: job.jobStartedAt,
                jobCompletedAt: job.jobCompletedAt,
                startDate: job.startDate,
                staffRequirements: job.staffRequirements,
                partyRequirement: job.partyRequirement,
                jobCategory: job.jobCategory,
                customer: job.customer
            },
            assignedStaff: job.assignedStaff
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    ...oldExports,
    applyForJob,
    resendJobNotification,
    completePayment,
    createCommercialWebJob,
    assignStaffToJob,
    startJobWithOtp,
    completeJobWithOtp,
    getAssignedStaff
};

