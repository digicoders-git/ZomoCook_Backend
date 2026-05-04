const express = require('express');
const router = express.Router();
const { getDashboardStats, getPositionJobStats } = require('../controllers/dashboardController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getDashboardStats);
router.get('/position-jobs', protect, getPositionJobStats);

module.exports = router;
