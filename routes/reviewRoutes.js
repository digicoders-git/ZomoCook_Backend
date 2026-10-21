const express = require('express');
const router = express.Router();
const {
    submitReview,
    getCookReviews,
    getJobReviews
} = require('../controllers/reviewController');
const { protect } = require('../middleware/authMiddleware');

// Public or auth-protected getCookReviews
router.get('/cook/:cookId', (req, res, next) => {
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        return protect(req, res, next);
    }
    next();
}, getCookReviews);

// Reviews for a specific job
router.get('/job/:jobId', protect, getJobReviews);

// Submit review
router.post('/', protect, submitReview);

module.exports = router;
