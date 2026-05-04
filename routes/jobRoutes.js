const express = require('express');
const router = express.Router();
const { 
    createJob, 
    getJobs, 
    getJob, 
    updateJob, 
    deleteJob, 
    toggleJobStatus,
    updateJobStatus
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

router.route('/:id')
    .get(protect, getJob)
    .put(protect, upload.single('image'), updateJob)
    .delete(protect, deleteJob);

router.patch('/:id/status', protect, toggleJobStatus);
router.patch('/:id/status-string', protect, updateJobStatus);

module.exports = router;
