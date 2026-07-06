const express = require('express');
const router = express.Router();
const {
    getPendingCookApprovals,
    getCookVerificationDetails,
    approveCook,
    rejectCook,
    resubmitCookProfile,
    getCookProfileStatus
} = require('../controllers/candidateVerificationController');
const { protect } = require('../middleware/authMiddleware');

// Admin routes for cook approval
router.get('/admin/pending-cook-approvals', protect, getPendingCookApprovals);
router.get('/admin/cook-verification/:id', protect, getCookVerificationDetails);
router.post('/admin/approve/:id', protect, approveCook);
router.post('/admin/reject/:id', protect, rejectCook);

// Cook routes
router.get('/:id/profile-status', protect, getCookProfileStatus);
router.post('/:id/resubmit-profile', protect, resubmitCookProfile);

module.exports = router;
