const express = require('express');
const router = express.Router();
const { 
    createJob, 
    getJobs, 
    getJob, 
    updateJob, 
    deleteJob, 
    toggleJobStatus,
    updateJobStatus,
    saveJob,
    unsaveJob,
    getSavedJobs,
    applyForJob,
    resendJobNotification,
    completePayment
} = require('../controllers/jobController');
const { protect } = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');

// Multer Config for Job Images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `job-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ storage });

router.route('/')
    .get(protect, getJobs)
    .post(protect, upload.single('image'), createJob);

router.route('/saved')
    .get(protect, getSavedJobs);

router.route('/:id')
    .get(protect, getJob)
    .put(protect, upload.single('image'), updateJob)
    .delete(protect, deleteJob);

router.route('/:id/save')
    .post(protect, saveJob)
    .delete(protect, unsaveJob);

router.post('/:id/apply', protect, applyForJob);

router.patch('/:id/status', protect, toggleJobStatus);
router.patch('/:id/status-string', protect, updateJobStatus);
router.post('/:id/resend-notification', protect, resendJobNotification);
router.post('/:id/complete-payment', protect, completePayment);

module.exports = router;
