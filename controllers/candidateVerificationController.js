const Candidate = require('../models/Candidate');
const Admin = require('../models/Admin');

/**
 * @desc    Get pending cook approvals for admin
 * @route   GET /api/admin/pending-cook-approvals
 * @access  Private (Admin)
 */
const getPendingCookApprovals = async (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;

        let query = {
            'profileVerification.status': status || 'pending_approval'
        };

        const skip = (page - 1) * limit;

        const candidates = await Candidate.find(query)
            .select('name email phone city profileImage documents profileVerification createdAt')
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });

        const total = await Candidate.countDocuments(query);

        res.status(200).json({
            success: true,
            count: candidates.length,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit),
            candidates
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get cook verification details for admin review
 * @route   GET /api/admin/cook-verification/:id
 * @access  Private (Admin)
 */
const getCookVerificationDetails = async (req, res) => {
    try {
        const candidate = await Candidate.findById(req.params.id)
            .select('-applications -savedJobs');

        if (!candidate) {
            return res.status(404).json({ success: false, message: 'Cook not found' });
        }

        res.status(200).json({
            success: true,
            candidate
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Approve cook profile
 * @route   POST /api/admin/approve-cook/:id
 * @access  Private (Admin)
 */
const approveCook = async (req, res) => {
    try {
        const { approvalNotes, verificationChecklist } = req.body;
        const candidateId = req.params.id;
        const adminId = req.admin._id;

        const candidate = await Candidate.findById(candidateId);
        if (!candidate) {
            return res.status(404).json({ success: false, message: 'Cook not found' });
        }

        // Update profile verification
        candidate.profileVerification = {
            status: 'approved',
            photoVerified: true,
            photoVerificationDate: new Date(),
            idVerified: true,
            idVerificationDate: new Date(),
            canApplyForJobs: true,
            approvedBy: adminId,
            approvalDate: new Date(),
            approvalNotes: approvalNotes || '',
            verificationChecklist: verificationChecklist || {
                photoAppropriate: true,
                photoClarity: true,
                idProofValid: true,
                nameMatches: true,
                ageVerified: true,
                addressVerified: true,
                backgroundCheckPassed: true
            }
        };

        await candidate.save();

        // Send notification to cook
        const notificationController = require('./notificationController');
        notificationController.sendNotificationToUser({
            userId: candidate._id,
            userModel: 'Candidate',
            title: '✅ Profile Approved',
            message: 'Congratulations! Your profile has been approved. You can now apply for jobs.',
            type: 'profile_status',
            relatedId: candidate._id,
            relatedModel: 'Candidate',
            actionUrl: '/jobs'
        }).catch(err => console.error('Error sending approval notification:', err));

        res.status(200).json({
            success: true,
            message: 'Cook profile approved successfully',
            candidate
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Reject cook profile
 * @route   POST /api/admin/reject-cook/:id
 * @access  Private (Admin)
 */
const rejectCook = async (req, res) => {
    try {
        const { rejectionReason, photoRejectionReason, idRejectionReason } = req.body;
        const candidateId = req.params.id;
        const adminId = req.admin._id;

        if (!rejectionReason) {
            return res.status(400).json({ success: false, message: 'Rejection reason is required' });
        }

        const candidate = await Candidate.findById(candidateId);
        if (!candidate) {
            return res.status(404).json({ success: false, message: 'Cook not found' });
        }

        // Update profile verification
        candidate.profileVerification = {
            status: 'rejected',
            photoVerified: false,
            photoRejectionReason: photoRejectionReason || '',
            idVerified: false,
            idRejectionReason: idRejectionReason || '',
            canApplyForJobs: false,
            rejectedBy: adminId,
            rejectionDate: new Date(),
            rejectionReason: rejectionReason,
            submissionCount: (candidate.profileVerification?.submissionCount || 0) + 1
        };

        await candidate.save();

        // Send notification to cook
        const notificationController = require('./notificationController');
        notificationController.sendNotificationToUser({
            userId: candidate._id,
            userModel: 'Candidate',
            title: '❌ Profile Rejected',
            message: `Your profile was not approved. Reason: ${rejectionReason}. You can resubmit after fixing the issues.`,
            type: 'profile_status',
            relatedId: candidate._id,
            relatedModel: 'Candidate',
            actionUrl: '/profile'
        }).catch(err => console.error('Error sending rejection notification:', err));

        res.status(200).json({
            success: true,
            message: 'Cook profile rejected',
            candidate
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Resubmit cook profile for approval
 * @route   POST /api/candidates/:id/resubmit-profile
 * @access  Private (Cook)
 */
const resubmitCookProfile = async (req, res) => {
    try {
        const candidateId = req.params.id;
        const candidate = await Candidate.findById(candidateId);

        if (!candidate) {
            return res.status(404).json({ success: false, message: 'Cook not found' });
        }

        // Check if profile was rejected
        if (candidate.profileVerification?.status !== 'rejected') {
            return res.status(400).json({
                success: false,
                message: 'Profile can only be resubmitted if it was rejected'
            });
        }

        // Reset profile verification for resubmission
        candidate.profileVerification = {
            status: 'pending_approval',
            photoVerified: false,
            idVerified: false,
            canApplyForJobs: false,
            submissionCount: (candidate.profileVerification?.submissionCount || 0) + 1,
            lastSubmissionDate: new Date()
        };

        await candidate.save();

        res.status(200).json({
            success: true,
            message: 'Profile resubmitted for approval',
            candidate
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get cook profile status
 * @route   GET /api/candidates/:id/profile-status
 * @access  Private (Cook)
 */
const getCookProfileStatus = async (req, res) => {
    try {
        const candidate = await Candidate.findById(req.params.id)
            .select('profileVerification name email phone');

        if (!candidate) {
            return res.status(404).json({ success: false, message: 'Cook not found' });
        }

        res.status(200).json({
            success: true,
            profileStatus: candidate.profileVerification,
            canApplyForJobs: candidate.profileVerification?.canApplyForJobs || false
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getPendingCookApprovals,
    getCookVerificationDetails,
    approveCook,
    rejectCook,
    resubmitCookProfile,
    getCookProfileStatus
};
