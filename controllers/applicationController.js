const Application = require('../models/Application');
const Job = require('../models/Job');
const Candidate = require('../models/Candidate');
const ServicePackagePayment = require('../models/ServicePackagePayment');
const ServicePackage = require('../models/ServicePackage');
const Transaction = require('../models/Transaction');

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
            .populate('job', 'title jobCategory city state salaryRange salary outletName joiningType jobType jobPosition location address facilities otherFacilities leave allowedLeave image jobPreference')
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

        const validStatuses = ['Applied', 'Shortlisted', 'Profile Reviewed', 'Package Selected', 'Package Paid', 'Demo Scheduled', 'Demo In Progress', 'Demo Completed', 'Demo Cancelled', 'Reschedule Requested', 'Hired', 'Rejected', 'On Hold', 'Not Interested', 'Cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        const existingApp = await Application.findById(applicationId).populate('job');
        if (!existingApp) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }

        if (status === 'Demo Scheduled') {
            let isPaid = existingApp.servicePackagePaid;
            if (!isPaid) {
                const User = require('../models/User');
                const jobCreator = await User.findById(existingApp.customer || req.admin._id);
                if (jobCreator && jobCreator.activePlan && jobCreator.planExpiryDate && new Date(jobCreator.planExpiryDate) > new Date()) {
                    isPaid = true;
                    existingApp.servicePackagePaid = true;
                    await existingApp.save();
                }
            }
            if (!isPaid) {
                return res.status(400).json({
                    success: false,
                    message: 'Active subscription plan is required before scheduling a trial.',
                    requiresPayment: true
                });
            }
        }

        if (status === 'Hired' && existingApp.job) {
            const job = existingApp.job;
            const isDailyJob = job.jobCategory === 'daily';
            if (isDailyJob && job.advanceAmount > 0) {
                const remainingTxn = await Transaction.findOne({
                    relatedJob: job._id,
                    type: 'daily_job_remaining',
                    status: 'success'
                });
                if (!remainingTxn) {
                    return res.status(400).json({
                        success: false,
                        message: 'Hiring blocked. Remaining 75% payment is pending for this daily job.',
                        requiresRemainingPayment: true,
                        remainingAmount: Math.round(job.advanceAmount * 3),
                        jobId: job._id
                    });
                }
            }
        }

        const updateData = { status };
        if (req.body.demoDate) updateData.demoDate = req.body.demoDate;
        if (req.body.demoTime) updateData.demoTime = req.body.demoTime;
        if (req.body.demoMenu) updateData.demoMenu = Array.isArray(req.body.demoMenu) ? req.body.demoMenu : [req.body.demoMenu];
        if (req.body.demoNotes !== undefined) updateData.demoNotes = req.body.demoNotes;
        if (req.body.remarks) updateData.remarks = req.body.remarks;
        if (req.body.meetingLink) updateData.meetingLink = req.body.meetingLink;
        if (req.body.rejectionReason) updateData.rejectionReason = req.body.rejectionReason;
        if (req.body.joiningDate) updateData.joiningDate = req.body.joiningDate;

        const application = await Application.findByIdAndUpdate(
            applicationId,
            updateData,
            { new: true }
        ).populate('candidate').populate('job');

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
        const { demoDate, demoTime, meetingLink, demoMenu, demoNotes, remarks } = req.body;
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
            const jobCreator = await User.findById(application.customer);
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
        if (meetingLink) application.meetingLink = meetingLink;
        if (demoMenu) application.demoMenu = Array.isArray(demoMenu) ? demoMenu : [demoMenu];
        if (demoNotes !== undefined) application.demoNotes = demoNotes;
        if (remarks) application.remarks = remarks;

        // Generate random 4-digit OTP for demo/trial verification
        if (!application.trialOtp) {
            application.trialOtp = Math.floor(1000 + Math.random() * 9000).toString();
        }
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
        const { demoDate, demoTime, meetingLink, demoMenu, demoNotes, remarks } = req.body;
        const applicationId = req.params.id;

        if (!demoDate || !demoTime) {
            return res.status(400).json({ success: false, message: 'Demo date and time are required' });
        }

        const updateData = {
            status: 'Reschedule Requested',
            demoDate,
            demoTime,
        };
        if (meetingLink) updateData.meetingLink = meetingLink;
        if (demoMenu) updateData.demoMenu = Array.isArray(demoMenu) ? demoMenu : [demoMenu];
        if (demoNotes !== undefined) updateData.demoNotes = demoNotes;
        if (remarks) updateData.remarks = remarks;

        const application = await Application.findByIdAndUpdate(
            applicationId,
            updateData,
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
        const { joiningDate, offeredSalary } = req.body;
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

        if (application.job) {
            const job = application.job;
            const isDailyJob = job.jobCategory === 'daily';
            if (isDailyJob && job.advanceAmount > 0) {
                const remainingTxn = await Transaction.findOne({
                    relatedJob: job._id,
                    type: 'daily_job_remaining',
                    status: 'success'
                });
                if (!remainingTxn) {
                    return res.status(400).json({
                        success: false,
                        message: 'Hiring blocked. Remaining 75% payment is pending for this daily job.',
                        requiresRemainingPayment: true,
                        remainingAmount: Math.round(job.advanceAmount * 3),
                        jobId: job._id
                    });
                }
            }
        }

        application.status = 'Hired';
        application.joiningDate = joiningDate;
        if (offeredSalary) {
            application.offeredSalary = offeredSalary.toString();
        }
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
        if (offeredSalary) {
            const cleanSalary = offeredSalary.toString().replace(/[^0-9.]/g, '');
            if (cleanSalary) {
                amount = parseFloat(cleanSalary) || 15000;
            }
        } else if (application.job && application.job.salaryRange) {
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
        const { rejectionReason, notes } = req.body;
        const applicationId = req.params.id;

        const application = await Application.findById(applicationId)
            .populate('job')
            .populate('candidate')
            .populate('servicePackagePaymentId');

        if (!application) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }

        application.status = 'Rejected';
        application.rejectionReason = rejectionReason || 'Not selected';
        if (notes) {
            application.rejectionNotes = notes.toString();
        }
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

/**
 * @desc    Start trial / demo
 * @route   POST /api/applications/:id/start-trial
 * @access  Private (Cook/Admin)
 */
const startTrial = async (req, res) => {
    try {
        const applicationId = req.params.id;
        const application = await Application.findById(applicationId)
            .populate('job')
            .populate('candidate')
            .populate('customer');

        if (!application) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }

        // Generate random 4-digit OTP or keep existing
        const otp = application.trialOtp || Math.floor(1000 + Math.random() * 9000).toString();
        const otpExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // Active until trial ends

        application.trialStatus = 'in_progress';
        application.trialStartedAt = new Date();
        application.status = 'Demo In Progress';
        application.trialOtp = otp;
        application.trialOtpExpiresAt = otpExpiresAt;
        await application.save();

        const notificationController = require('./notificationController');
        if (application.customer) {
            notificationController.sendNotificationToUser({
                userId: application.customer._id || application.customer,
                userModel: 'User',
                title: '👨‍🍳 Trial Started',
                message: `Chef ${application.candidate?.name || 'Cook'} has started the trial for "${application.job?.title || 'your job'}". Trial completion OTP is: ${otp}`,
                type: 'trial_started',
                relatedId: application._id,
                relatedModel: 'Application',
                actionUrl: '/bookings'
            }).catch(err => console.error('Error sending trial started notification:', err));
        }

        await syncCandidateApplication(application);

        res.status(200).json({
            success: true,
            message: 'Trial started successfully',
            application,
            otp
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Send / Resend Trial OTP
 * @route   POST /api/applications/:id/send-trial-otp
 * @access  Private (Cook/Admin)
 */
const sendTrialOtp = async (req, res) => {
    try {
        const applicationId = req.params.id;
        const application = await Application.findById(applicationId)
            .populate('job')
            .populate('candidate')
            .populate('customer');

        if (!application) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }

        const otp = application.trialOtp || Math.floor(1000 + Math.random() * 9000).toString();
        application.trialOtp = otp;
        application.trialOtpExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await application.save();

        if (application.customer) {
            const notificationController = require('./notificationController');
            notificationController.sendNotificationToUser({
                userId: application.customer._id || application.customer,
                userModel: 'User',
                title: '🔐 Trial Verification OTP',
                message: `Your trial completion OTP for "${application.job?.title || 'Job'}" is: ${otp}.`,
                type: 'trial_otp',
                relatedId: application._id,
                relatedModel: 'Application',
                actionUrl: '/bookings'
            }).catch(err => console.error('Error sending trial OTP notification:', err));
        }

        res.status(200).json({
            success: true,
            message: 'Trial OTP sent successfully to customer',
            otp
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Verify OTP and complete trial
 * @route   POST /api/applications/:id/complete-trial
 * @access  Private (Cook/Admin)
 */
const completeTrial = async (req, res) => {
    try {
        const applicationId = req.params.id;
        const { otp } = req.body;

        if (!otp) {
            return res.status(400).json({ success: false, message: 'Please enter the customer verification OTP' });
        }

        const application = await Application.findById(applicationId)
            .populate('job')
            .populate('candidate')
            .populate('customer');

        if (!application) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }

        const enteredOtp = otp.toString().trim();
        const validOtps = [application.trialOtp].filter(Boolean);

        const isMatch = validOtps.includes(enteredOtp);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Invalid OTP. Please ask customer for the correct OTP.' });
        }

        const completedAt = new Date();
        const startedAt = application.trialStartedAt || new Date(Date.now() - 3600 * 1000);
        const durationSeconds = Math.max(0, Math.round((completedAt.getTime() - new Date(startedAt).getTime()) / 1000));

        application.trialStatus = 'completed';
        application.trialCompletedAt = completedAt;
        application.status = 'Demo Completed';
        application.trialDurationSeconds = durationSeconds;
        await application.save();

        const notificationController = require('./notificationController');
        if (application.customer) {
            notificationController.sendNotificationToUser({
                userId: application.customer._id || application.customer,
                userModel: 'User',
                title: '✅ Trial Completed',
                message: `Trial for "${application.job?.title || 'Job'}" has been completed successfully by ${application.candidate?.name || 'Cook'}. You can now hire the candidate.`,
                type: 'trial_completed',
                relatedId: application._id,
                relatedModel: 'Application',
                actionUrl: '/bookings'
            }).catch(err => console.error('Error sending trial completed notification to customer:', err));
        }

        if (application.candidate) {
            notificationController.sendNotificationToUser({
                userId: application.candidate._id || application.candidate,
                userModel: 'Candidate',
                title: '🎉 Trial Verified & Completed',
                message: `Your trial for "${application.job?.title || 'Job'}" has been verified with OTP and marked complete.`,
                type: 'trial_completed',
                relatedId: application._id,
                relatedModel: 'Application',
                actionUrl: '/bookings'
            }).catch(err => console.error('Error sending trial completed notification to candidate:', err));
        }

        await syncCandidateApplication(application);

        res.status(200).json({
            success: true,
            message: 'Trial completed and verified successfully',
            application
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Cancel trial
 * @route   POST /api/applications/:id/cancel-trial
 * @access  Private (Cook/Customer/Admin)
 */
const cancelTrial = async (req, res) => {
    try {
        const applicationId = req.params.id;
        const { reason, notes } = req.body;

        const application = await Application.findById(applicationId)
            .populate('job')
            .populate('candidate')
            .populate('customer');

        if (!application) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }

        application.trialStatus = 'cancelled';
        application.trialCancelledAt = new Date();
        application.trialCancellationReason = reason || 'Cancelled by user';
        application.trialCancellationNotes = notes || '';
        application.status = 'Cancelled';
        await application.save();

        const notificationController = require('./notificationController');
        if (application.customer) {
            notificationController.sendNotificationToUser({
                userId: application.customer._id || application.customer,
                userModel: 'User',
                title: '❌ Trial Cancelled',
                message: `Trial for "${application.job?.title || 'Job'}" was cancelled. Reason: ${reason || 'Not specified'}`,
                type: 'trial_cancelled',
                relatedId: application._id,
                relatedModel: 'Application',
                actionUrl: '/bookings'
            }).catch(err => console.error('Error sending trial cancelled notification to customer:', err));
        }

        await syncCandidateApplication(application);

        res.status(200).json({
            success: true,
            message: 'Trial cancelled successfully',
            application
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Cook accepts job offer
 * @route   POST /api/applications/:id/cook-accept-offer
 * @access  Private (Cook)
 */
const cookAcceptOffer = async (req, res) => {
    try {
        const applicationId = req.params.id;
        const application = await Application.findById(applicationId)
            .populate('job')
            .populate('candidate')
            .populate('customer');

        if (!application) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }

        application.status = 'Offer Accepted';
        application.offerStatus = 'accepted';
        application.offerDecisionDate = new Date();
        await application.save();

        await syncCandidateApplication(application);

        // Notify customer
        if (application.customer) {
            const notificationController = require('./notificationController');
            const cookName = application.candidate?.name || 'Chef';
            const jobTitle = application.job?.title || 'job';
            let joiningDateStr = '';
            if (application.joiningDate) {
                try {
                    const d = new Date(application.joiningDate);
                    joiningDateStr = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
                } catch (_) {}
            }

            notificationController.sendNotificationToUser({
                userId: application.customer._id || application.customer,
                userModel: 'User',
                title: '🎉 Offer Accepted!',
                message: `Chef ${cookName} has accepted your job offer for "${jobTitle}"${joiningDateStr ? ` (Joining Date: ${joiningDateStr})` : ''}.`,
                type: 'offer_accepted',
                relatedId: application._id,
                relatedModel: 'Application',
                actionUrl: '/bookings'
            }).catch(err => console.error('Error sending offer accepted notification:', err));
        }

        res.status(200).json({
            success: true,
            message: 'Job offer accepted successfully',
            application
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Cook rejects job offer
 * @route   POST /api/applications/:id/cook-reject-offer
 * @access  Private (Cook)
 */
const cookRejectOffer = async (req, res) => {
    try {
        const applicationId = req.params.id;
        const { reason } = req.body;

        const application = await Application.findById(applicationId)
            .populate('job')
            .populate('candidate')
            .populate('customer');

        if (!application) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }

        application.status = 'Offer Rejected';
        application.offerStatus = 'rejected';
        application.offerDecisionDate = new Date();
        application.rejectionReason = reason || 'Rejected by Cook';
        await application.save();

        // Update any associated booking to Cancelled
        try {
            const Booking = require('../models/Booking');
            await Booking.updateMany(
                { application: application._id },
                { $set: { status: 'Cancelled', cancellationReason: 'Job offer rejected by cook' } }
            );
        } catch (bErr) {
            console.error('Error updating booking status on offer reject:', bErr);
        }

        await syncCandidateApplication(application);

        // Notify customer
        if (application.customer) {
            const notificationController = require('./notificationController');
            const cookName = application.candidate?.name || 'Chef';
            const jobTitle = application.job?.title || 'job';

            notificationController.sendNotificationToUser({
                userId: application.customer._id || application.customer,
                userModel: 'User',
                title: '❌ Job Offer Rejected',
                message: `Chef ${cookName} has rejected your job offer for "${jobTitle}". You can review other candidates.`,
                type: 'offer_rejected',
                relatedId: application._id,
                relatedModel: 'Application',
                actionUrl: '/jobs'
            }).catch(err => console.error('Error sending offer rejected notification:', err));
        }

        res.status(200).json({
            success: true,
            message: 'Job offer rejected successfully',
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
    getApplicationById,
    startTrial,
    sendTrialOtp,
    completeTrial,
    cancelTrial,
    cookAcceptOffer,
    cookRejectOffer
};
