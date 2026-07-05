const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/applicationController');
const { protect } = require('../middleware/authMiddleware');

// Cook applies for job
router.post('/apply', protect, applyJob);

// Get cook's applications
router.get('/cook/my-applications', protect, getMyApplications);

// Get all applications (for customer)
router.get('/', protect, getApplications);

// Get single application
router.get('/:id', protect, getApplicationById);

// Update application status
router.patch('/:id/status', protect, updateApplicationStatus);

// Select service package
router.post('/:id/select-package', protect, selectServicePackage);

// Schedule demo (only after package payment)
router.post('/:id/schedule-demo', protect, scheduleDemo);

// Reschedule demo
router.post('/:id/reschedule-demo', protect, rescheduleDemo);

// Hire cook
router.post('/:id/hire', protect, hireCook);

// Reject application
router.post('/:id/reject', protect, rejectApplication);

module.exports = router;
