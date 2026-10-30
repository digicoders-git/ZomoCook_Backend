const express = require('express');
const router = express.Router();
const {
    submitReview,
    getCookReviews,
    getJobReviews,
    getAllReviews,
    updateReviewStatus,
    deleteReview
} = require('../controllers/reviewController');
const { protect } = require('../middleware/authMiddleware');

// Get all reviews (Admin) or submit review
router.route('/')
    .get(protect, getAllReviews)
    .post(protect, submitReview);

// Public or auth-protected getCookReviews
router.get('/cook/:cookId', (req, res, next) => {
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        return protect(req, res, next);
    }
    next();
}, getCookReviews);

// Reviews for a specific job
router.get('/job/:jobId', protect, getJobReviews);

// Update status / Delete review
router.patch('/:id/status', protect, updateReviewStatus);
router.delete('/:id', protect, deleteReview);

module.exports = router;
