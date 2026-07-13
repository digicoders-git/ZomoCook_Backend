const Application = require('../models/Application');
const Job = require('../models/Job');
const Candidate = require('../models/Candidate');
const ServicePackagePayment = require('../models/ServicePackagePayment');
const ServicePackage = require('../models/ServicePackage');

const syncCandidateApplication = async (application) => {
    if (!application || !application.candidate || !application.job) return;

    const candidateId = application.candidate._id || application.candidate;
    const jobId = application.job._id || application.job;

    const result = await Candidate.updateOne(
        { _id: candidateId, 'applications.job': jobId },
        {
            $set: {
                'applications.$.status': application.status,
                'applications.$.remarks': application.remarks || application.rejectionReason || '',
                'applications.$.appliedDate': application.appliedDate || new Date()
            }
        }
    );

    if (result.matchedCount === 0) {
        await Candidate.findByIdAndUpdate(candidateId, {
            $push: {
                applications: {
                    job: jobId,
                    status: application.status,
                    remarks: application.remarks || application.rejectionReason || '',
                    appliedDate: application.appliedDate || new Date()
                }
            }
        });
    }
};

/**
 * @desc    Apply for a job (Auto-creates application)
 * @route   POST /api/applications/apply
 * @access  Private (Cook)
 */
const applyJob = async (req, res) => {
    try {
        const { jobId, applicationData } = req.body;
        const candidateId = req.admin._id;

        if (jobId === 'dummy-nearby-job-001' || jobId === '657e2d9b62649a15f0123456') {
            return res.status(201).json({
                success: true,
                message: 'Application submitted successfully'
            });
        }

        const job = await Job.findById(jobId);
        if (!job) return res.status(404).json({ success: false, message: 'Job not found' });

        const last10 = req.admin.phone ? req.admin.phone.slice(-10) : '';
        let candidate = await Candidate.findOne({
            $or: [
                { _id: candidateId },
                { createdBy: candidateId },
                { phone: last10 ? new RegExp(last10 + '$') : req.admin.phone }
            ]
        });
        if (!candidate && req.admin.phone) {
            candidate = await Candidate.create({
                name: req.admin.name || `Cook_${req.admin.phone.slice(-4)}`,
                email: req.admin.email,
                phone: req.admin.phone,
                city: req.admin.city,
                address: req.admin.address,
                profileImage: req.admin.profilePic,
                createdBy: req.admin._id,
                creatorModel: req.admin.constructor.modelName,
                profileVerification: {
                    status: 'pending_approval',
                    canApplyForJobs: false
                }
            });
        }
        if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });

        // ✅ CHECK PROFILE APPROVAL BEFORE ALLOWING JOB APPLICATION
        if (!candidate.profileVerification?.canApplyForJobs) {
            return res.status(403).json({
                success: false,
                message: 'Your profile is pending admin approval. You cannot apply for jobs until your profile is approved.',
                profileStatus: candidate.profileVerification?.status || 'pending_approval',
                requiresApproval: true
            });
        }

        const existingApp = await Application.findOne({ job: jobId, candidate: candidate._id });
        if (existingApp) {
            return res.status(400).json({ success: false, message: 'You have already applied for this job' });
        }

        const application = await Application.create({
            job: jobId,
            candidate: candidate._id,
            customer: job.createdBy,
            status: 'Applied',
            applicationData: applicationData || {},
            appliedDate: new Date()
        });

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

        await syncCandidateApplication(application);

        res.status(201).json({
            success: true,
            message: 'Application submitted successfully',
            application
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get all applications (for admin/customer) - ONLY SHOW APPROVED COOK PROFILES
 * @route   GET /api/applications
 * @access  Private
 */
const getApplications = async (req, res) => {
    try {
        const { status, jobId, candidateId } = req.query;
        const userId = req.admin._id;

        let query = {};

        const isCustomer = req.admin.constructor.modelName === 'User';
        
        if (isCustomer) {
            const Job = require('../models/Job');
            const Customer = require('../models/Customer');
            
            const last10 = req.admin.phone ? req.admin.phone.slice(-10) : '';
            const customerDocs = await Customer.find({
                $or: [
                    { createdBy: userId },
                    { contactPhone: new RegExp(last10 + '$') }
                ]
            });
            const customerIds = customerDocs.map(c => c._id);

            const myJobs = await Job.find({ 
                $or: [
                    { createdBy: userId },
                    { customer: { $in: customerIds } }
                ]
            });
            const jobIds = myJobs.map(j => j._id);
            query.$or = [
                { customer: userId },
                { job: { $in: jobIds } }
            ];
        }

        if (status) query.status = status;
        if (jobId) query.job = jobId;
        if (candidateId) query.candidate = candidateId;

        const applications = await Application.find(query)
            .populate({
                path: 'candidate',
                select: 'name phone city profileImage jobPreference profileVerification',
                match: { 'profileVerification.status': 'approved' }
            })
            .populate('job', 'title jobCategory jobType city state salaryRange outletName joiningType jobPosition')
            .populate('customer', 'name email phone outletName')
            .populate('servicePackagePaymentId')
            .sort({ appliedDate: -1 });

        // Filter out applications where candidate is null (not approved)
        const filteredApplications = applications.filter(app => app.candidate !== null);

        res.status(200).json({
            success: true,
            count: filteredApplications.length,
            applications: filteredApplications
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get applications for cook
 * @route   GET /api/applications/cook/my-applications
 * @access  Private (Cook)
 */
const getMyApplications = async (req, res) => {
    try {
        const { status } = req.query;
        const userId = req.admin._id;
        const last10 = req.admin.phone ? req.admin.phone.slice(-10) : '';

        const candidate = await Candidate.findOne({
            $or: [
                { _id: userId },
                { createdBy: userId },
                ...(last10 ? [{ phone: new RegExp(last10 + '$') }] : [])
            ]
        });

        let query = {};
        if (candidate) {
            query.candidate = candidate._id;
        } else {
            query.candidate = userId;
        }
        if (status) query.status = status;

        const applications = await Application.find(query)
            .populate('job', 'title jobCategory city state salaryRange salary outletName joiningType jobType jobPosition')
            .populate('customer', 'name email phone outletName')
            .sort({ appliedDate: -1 });

        res.status(200).json({
            success: true,
            count: applications.length,
            applications
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Update application status
 * @route   PATCH /api/applications/:id/status
 * @access  Private (Customer/Admin)
 */
const updateApplicationStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const applicationId = req.params.id;

        const validStatuses = ['Applied', 'Shortlisted', 'Profile Reviewed', 'Package Selected', 'Package Paid', 'Demo Scheduled', 'Reschedule Requested', 'Hired', 'Rejected', 'On Hold', 'Not Interested', 'Cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        const application = await Application.findByIdAndUpdate(
            applicationId,
            { status },
            { new: true }
        ).populate('candidate').populate('job');

        if (!application) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }

        if (application.candidate) {
            const notificationController = require('./notificationController');

            let notifTitle = '📋 Application Update';
            let notifMessage = '';

            switch (status) {
                case 'Shortlisted':
                    notifTitle = '🌟 Profile Shortlisted';
                    notifMessage = 'Your profile has been shortlisted by the employer.';
                    break;
                case 'Profile Reviewed':
                    notifTitle = '👀 Profile Under Review';
                    notifMessage = 'Your profile is being reviewed by the employer.';
                    break;
                case 'Package Selected':
                    notifTitle = '📦 Service Package Selected';
                    notifMessage = 'Employer has selected a service package for your profile.';
                    break;
                case 'Package Paid':
                    notifTitle = '💳 Service Package Paid';
                    notifMessage = 'Service package payment confirmed. Demo will be scheduled soon.';
                    break;
                case 'Hired':
                    notifTitle = '🎉 Congratulations!';
                    notifMessage = 'Congratulations! You have been selected. View joining details.';
                    break;
                case 'Rejected':
                    notifTitle = '📋 Application Update';
                    notifMessage = `Your application for "${application.job?.title}" was not selected at this time.`;
                    break;
                case 'On Hold':
                    notifTitle = '⏳ Application On Hold';
                    notifMessage = `Your application for "${application.job?.title}" is currently on hold.`;
                    break;
                case 'Not Interested':
                    notifTitle = '📋 Application Closed';
                    notifMessage = `The employer has closed your application for "${application.job?.title}".`;
                    break;
                default:
                    notifTitle = '📋 Application Status Updated';
                    notifMessage = `Your application for "${application.job?.title}" has been updated to "${status}".`;
            }

            notificationController.sendNotificationToUser({
                userId: application.candidate._id,
                userModel: 'Candidate',
                title: notifTitle,
                message: notifMessage,
                type: status === 'Hired' ? 'hired' : 'application_status',
                relatedId: application._id,
                relatedModel: 'Application',
                actionUrl: status === 'Hired' ? '/bookings' : '/applications'
            }).catch(err => console.error('Error sending application status update push notification:', err));

            if (status === 'Shortlisted' || status === 'Hired') {
                const customerTitle = status === 'Shortlisted' ? '🌟 Cook Shortlisted' : '🎉 Cook Hired';
                const customerMessage = `"${application.candidate?.name || 'A candidate'}" has been ${status === 'Shortlisted' ? 'shortlisted' : 'hired'} for your job "${application.job?.title || 'hiring requirement'}".`;
                
                notificationController.sendNotificationToUser({
                    userId: application.customer,
                    userModel: 'User',
                    title: customerTitle,
                    message: customerMessage,
                    type: 'candidate_assigned',
                    relatedId: application._id,
                    relatedModel: 'Application',
                    actionUrl: '/bookings'
                }).catch(err => console.error('Error sending application status update push notification to customer:', err));
            }
        }

        await syncCandidateApplication(application);

        if (status === 'Hired') {
            const Booking = require('../models/Booking');
            const existingBooking = await Booking.findOne({
                job: application.job._id,
                cook: application.candidate._id
            });
            
            if (!existingBooking) {
                let amount = 15000;
                if (application.job && application.job.salaryRange) {
                    const match = application.job.salaryRange.match(/\d+/);
                    if (match) {
                        amount = parseInt(match[0]);
                        if (application.job.salaryRange.toLowerCase().includes('k') && amount < 100) {
                            amount = amount * 1000;
                        }
                    }
                }
                
                await Booking.create({
                    job: application.job._id,
                    customer: application.customer,
                    cook: application.candidate._id,
                    totalAmount: amount,
                    duration: application.job.jobType || 'Full Time',
                    status: 'confirmed',
                    startDate: application.joiningDate || new Date()
                });
            }
        }

        res.status(200).json({
            success: true,
            message: `Application status updated to ${status}`,
            application
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Select service package for application
 * @route   POST /api/applications/:id/select-package
 * @access  Private (Customer)
 */
const selectServicePackage = async (req, res) => {
    try {
        const { packageType } = req.body;
        const applicationId = req.params.id;

        if (!['Basic', 'Standard', 'Premium'].includes(packageType)) {
            return res.status(400).json({ success: false, message: 'Invalid package type' });
        }

        const application = await Application.findById(applicationId);
        if (!application) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }

        const servicePackage = await ServicePackage.findOne({ name: packageType, isActive: true });
        if (!servicePackage) {
            return res.status(404).json({ success: false, message: 'Service package not found' });
        }

        application.servicePackage = packageType;
        application.status = 'Package Selected';
        application.packageSelectedDate = new Date();
        await application.save();

        const notificationController = require('./notificationController');
        notificationController.sendNotificationToUser({
            userId: application.customer,
            userModel: 'User',
            title: '📦 Package Selected',
            message: `You have selected ${packageType} package. Proceed to payment.`,
            type: 'application_status',
            relatedId: application._id,
            relatedModel: 'Application',
            actionUrl: '/applications'
        }).catch(err => console.error('Error sending package selected notification:', err));

        res.status(200).json({
            success: true,
            message: 'Service package selected successfully',
            application,
            packageDetails: servicePackage
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Schedule demo - ONLY after service package is paid
 * @route   POST /api/applications/:id/schedule-demo
 * @access  Private (Customer)
 */
const scheduleDemo = async (req, res) => {
    try {
        const { demoDate, demoTime, meetingLink } = req.body;
        const applicationId = req.params.id;

        if (!demoDate || !demoTime) {
            return res.status(400).json({ success: false, message: 'Demo date and time are required' });
        }

        const application = await Application.findById(applicationId).populate('candidate').populate('job');
        if (!application) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }

        let isPaid = application.servicePackagePaid;
        if (!isPaid) {
            const User = require('../models/User');
            const jobCreator = await User.findById(application.job?.createdBy || application.job?.customer);
            if (jobCreator && jobCreator.activePlan && new Date(jobCreator.planExpiryDate) > new Date()) {
                isPaid = true;
                application.servicePackagePaid = true;
                await application.save();
            }
        }

        if (!isPaid) {
            return res.status(400).json({ 
                success: false, 
                message: 'Service package payment is required before scheduling demo',
                requiresPayment: true
            });
        }

        application.status = 'Demo Scheduled';
        application.demoDate = demoDate;
        application.demoTime = demoTime;
        application.meetingLink = meetingLink;
        await application.save();

        const notificationController = require('./notificationController');
        notificationController.sendNotificationToUser({
            userId: application.candidate._id,
            userModel: 'Candidate',
            title: '📅 Demo Scheduled',
            message: `Your demo for "${application.job?.title}" is scheduled on ${demoDate} at ${demoTime}.`,
            type: 'demo_scheduled',
            relatedId: application._id,
            relatedModel: 'Application',
            actionUrl: '/bookings'
        }).catch(err => console.error('Error sending demo scheduled push notification:', err));

        await syncCandidateApplication(application);

        res.status(200).json({
            success: true,
            message: 'Demo scheduled successfully',
            application
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Reschedule demo
 * @route   POST /api/applications/:id/reschedule-demo
 * @access  Private (Customer/Cook)
 */
const rescheduleDemo = async (req, res) => {
    try {
        const { demoDate, demoTime, meetingLink } = req.body;
        const applicationId = req.params.id;

        if (!demoDate || !demoTime) {
            return res.status(400).json({ success: false, message: 'Demo date and time are required' });
        }

        const application = await Application.findByIdAndUpdate(
            applicationId,
            {
                status: 'Reschedule Requested',
                demoDate,
                demoTime,
                meetingLink
            },
            { new: true }
        ).populate('candidate').populate('job');

        if (!application) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }

        const notificationController = require('./notificationController');
        const isChef = req.admin && req.admin.role && req.admin.role.name && req.admin.role.name.toLowerCase() !== 'cook';
        
        if (isChef) {
            if (application.candidate) {
                notificationController.sendNotificationToUser({
                    userId: application.candidate._id,
                    userModel: 'Candidate',
                    title: '📅 Demo Reschedule Requested',
                    message: `Chef has requested to reschedule the demo for "${application.job?.title}" to ${demoDate} at ${demoTime}.`,
                    type: 'demo_scheduled',
                    relatedId: application._id,
                    relatedModel: 'Application',
                    actionUrl: '/bookings'
                }).catch(err => console.error('Error sending reschedule demo push notification:', err));
            }
        } else {
            notificationController.sendNotificationToUser({
                userId: application.customer,
                userModel: 'User',
                title: '📅 Demo Reschedule Requested',
                message: `Cook has requested to reschedule the demo for "${application.job?.title}" to ${demoDate} at ${demoTime}.`,
                type: 'demo_scheduled',
                relatedId: application._id,
                relatedModel: 'Application',
                actionUrl: '/applications'
            }).catch(err => console.error('Error sending reschedule demo push notification:', err));
        }

        await syncCandidateApplication(application);

        res.status(200).json({
            success: true,
            message: 'Demo rescheduled successfully',
            application
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Hire cook (Create booking and update application)
 * @route   POST /api/applications/:id/hire
 * @access  Private (Customer)
 */
const hireCook = async (req, res) => {
    try {
        const { joiningDate } = req.body;
        const applicationId = req.params.id;

        if (!joiningDate) {
            return res.status(400).json({ success: false, message: 'Joining date is required' });
        }

        const application = await Application.findById(applicationId)
            .populate('job')
            .populate('candidate');

        if (!application) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }

        application.status = 'Hired';
        application.joiningDate = joiningDate;
        await application.save();
        await syncCandidateApplication(application);

        if (application.candidate) {
            const notificationController = require('./notificationController');
            notificationController.sendNotificationToUser({
                userId: application.candidate._id,
                userModel: 'Candidate',
                title: '🎉 Congratulations!',
                message: 'Congratulations! You have been selected. View joining details.',
                type: 'hired',
                relatedId: application._id,
                relatedModel: 'Application',
                actionUrl: '/bookings'
            }).catch(err => console.error('Error sending hired push notification:', err));

            const customerTitle = '🎉 Cook Hired';
            const customerMessage = `"${application.candidate?.name || 'A candidate'}" has been hired for your job "${application.job?.title || 'hiring requirement'}".`;
            
            notificationController.sendNotificationToUser({
                userId: application.customer,
                userModel: 'User',
                title: customerTitle,
                message: customerMessage,
                type: 'candidate_assigned',
                relatedId: application._id,
                relatedModel: 'Application',
                actionUrl: '/bookings'
            }).catch(err => console.error('Error sending hired push notification to customer:', err));
        }

        let amount = 15000;
        if (application.job && application.job.salaryRange) {
            const match = application.job.salaryRange.match(/\d+/);
            if (match) {
                amount = parseInt(match[0]);
                if (application.job.salaryRange.toLowerCase().includes('k') && amount < 100) {
                    amount = amount * 1000;
                }
            }
        }

        const Booking = require('../models/Booking');
        const booking = await Booking.create({
            job: application.job._id,
            customer: application.customer,
            cook: application.candidate._id,
            totalAmount: amount,
            duration: application.job.jobType || 'Full Time',
            status: 'confirmed',
            startDate: joiningDate ? new Date(joiningDate) : new Date()
        });

        res.status(200).json({
            success: true,
            message: 'Cook hired successfully',
            application,
            booking
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Reject application and handle replacement
 * @route   POST /api/applications/:id/reject
 * @access  Private (Customer)
 */
const rejectApplication = async (req, res) => {
    try {
        const { rejectionReason } = req.body;
        const applicationId = req.params.id;

        const application = await Application.findById(applicationId)
            .populate('candidate')
            .populate('job')
            .populate('servicePackagePaymentId');

        if (!application) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }

        application.status = 'Rejected';
        application.rejectionReason = rejectionReason || 'Not selected';
        await application.save();

        if (application.servicePackagePaymentId) {
            const payment = application.servicePackagePaymentId;
            const canReplace = payment.replacementsUsed < payment.replacementLimit;

            if (canReplace) {
                payment.replacementsUsed += 1;
                await payment.save();
            }
        }

        if (application.candidate) {
            const notificationController = require('./notificationController');
            notificationController.sendNotificationToUser({
                userId: application.candidate._id,
                userModel: 'Candidate',
                title: '📋 Application Status Update',
                message: `Your application for "${application.job?.title}" was not selected. Reason: ${rejectionReason || 'Not selected'}`,
                type: 'application_status',
                relatedId: application._id,
                relatedModel: 'Application',
                actionUrl: '/applications'
            }).catch(err => console.error('Error sending application rejection push notification:', err));
        }

        await syncCandidateApplication(application);

        res.status(200).json({
            success: true,
            message: 'Application rejected',
            application,
            replacementInfo: application.servicePackagePaymentId ? {
                replacementsUsed: application.servicePackagePaymentId.replacementsUsed,
                replacementLimit: application.servicePackagePaymentId.replacementLimit,
                canReplace: application.servicePackagePaymentId.replacementsUsed < application.servicePackagePaymentId.replacementLimit
            } : null
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get application by ID
 * @route   GET /api/applications/:id
 * @access  Private
 */
const getApplicationById = async (req, res) => {
    try {
        const application = await Application.findById(req.params.id)
            .populate('job')
            .populate('candidate')
            .populate('customer')
            .populate('servicePackagePaymentId');

        if (!application) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }

        if (req.admin && req.admin.constructor.modelName === 'User') {
            const wasAlreadyViewed = application.isViewedByClient;
            application.isViewedByClient = true;
            await application.save();

            if (!wasAlreadyViewed && application.candidate) {
                const notificationController = require('./notificationController');
                notificationController.sendNotificationToUser({
                    userId: application.candidate._id,
                    userModel: 'Candidate',
                    title: '👀 Profile Viewed',
                    message: 'Your profile has been shortlisted by the employer.',
                    type: 'application_status',
                    relatedId: application._id,
                    relatedModel: 'Application',
                    actionUrl: '/applications'
                }).catch(err => console.error('Error sending profile viewed notification:', err));
            }
        }

        res.status(200).json({
            success: true,
            application
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    applyJob,
    getApplications,
    getMyApplications,
    updateApplicationStatus,
    selectServicePackage,
    scheduleDemo,
    rescheduleDemo,
    hireCook,
    rejectApplication,
    getApplicationById
};
