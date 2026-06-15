const Application = require('../models/Application');
const Job = require('../models/Job');
const Candidate = require('../models/Candidate');

/**
 * @desc    Apply for a job (Auto-creates application)
 * @route   POST /api/applications/apply
 * @access  Private (Cook)
 */
const applyJob = async (req, res) => {
    try {
        const { jobId } = req.body;
        const candidateId = req.admin._id;

        // Get job and candidate details
        const job = await Job.findById(jobId);
        if (!job) return res.status(404).json({ success: false, message: 'Job not found' });

        const candidate = await Candidate.findById(candidateId);
        if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });

        // Check if already applied
        const existingApp = await Application.findOne({ job: jobId, candidate: candidateId });
        if (existingApp) {
            return res.status(400).json({ success: false, message: 'You have already applied for this job' });
        }

        // Create application
        const application = await Application.create({
            job: jobId,
            candidate: candidateId,
            customer: job.createdBy,
            status: 'Applied',
            appliedDate: new Date()
        });

        // Add to candidate's applications array (for backward compatibility)
        await Candidate.findByIdAndUpdate(
            candidateId,
            { $push: { applications: { job: jobId, status: 'Applied', appliedDate: new Date() } } },
            { new: true }
        );

        // TODO: Send notification to customer
        // TODO: Send notification to cook with status updates

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
 * @desc    Get all applications (for admin/customer)
 * @route   GET /api/applications
 * @access  Private
 */
const getApplications = async (req, res) => {
    try {
        const { status, jobId, candidateId } = req.query;
        const userId = req.admin._id;

        let query = {};

        // Check if user is customer (User) or admin
        const isCustomer = req.admin.constructor.modelName === 'User';
        
        if (isCustomer) {
            query.customer = userId; // Customer sees only their job applications
        }

        if (status) query.status = status;
        if (jobId) query.job = jobId;
        if (candidateId) query.candidate = candidateId;

        const applications = await Application.find(query)
            .populate('candidate', 'name phone email profileImage city')
            .populate('job', 'title jobCategory city salaryRange')
            .populate('customer', 'name email')
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
 * @desc    Get applications for cook
 * @route   GET /api/applications/cook/my-applications
 * @access  Private (Cook)
 */
const getMyApplications = async (req, res) => {
    try {
        const candidateId = req.admin._id;
        const { status } = req.query;

        let query = { candidate: candidateId };
        if (status) query.status = status;

        const applications = await Application.find(query)
            .populate('job', 'title jobCategory city salaryRange customer')
            .populate('customer', 'name email phone')
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

        const validStatuses = ['Applied', 'Shortlisted', 'Demo Scheduled', 'Reschedule Requested', 'Hired', 'Rejected', 'On Hold', 'Not Interested'];
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

        // TODO: Send notification to cook about status change

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
 * @desc    Schedule demo
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

        const application = await Application.findByIdAndUpdate(
            applicationId,
            {
                status: 'Demo Scheduled',
                demoDate,
                demoTime,
                meetingLink
            },
            { new: true }
        ).populate('candidate').populate('job');

        if (!application) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }

        // TODO: Send notification to cook with demo details

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

        // TODO: Send notification to cook about rescheduled demo

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

        // Update application status
        application.status = 'Hired';
        application.joiningDate = joiningDate;
        await application.save();

        // Auto-create booking record
        let amount = 15000; // default fallback
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

        // TODO: Send notification to cook about being hired
        // TODO: Send notification to customer about booking confirmation

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
 * @desc    Reject application
 * @route   POST /api/applications/:id/reject
 * @access  Private (Customer)
 */
const rejectApplication = async (req, res) => {
    try {
        const { rejectionReason } = req.body;
        const applicationId = req.params.id;

        const application = await Application.findByIdAndUpdate(
            applicationId,
            {
                status: 'Rejected',
                rejectionReason: rejectionReason || 'Not selected'
            },
            { new: true }
        ).populate('candidate').populate('job');

        if (!application) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }

        // TODO: Send notification to cook about rejection

        res.status(200).json({
            success: true,
            message: 'Application rejected',
            application
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
            .populate('customer');

        if (!application) {
            return res.status(404).json({ success: false, message: 'Application not found' });
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
    scheduleDemo,
    rescheduleDemo,
    hireCook,
    rejectApplication,
    getApplicationById
};
