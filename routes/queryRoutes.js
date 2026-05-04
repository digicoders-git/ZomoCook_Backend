const express = require('express');
const router = express.Router();
const { getQueries, createQuery, deleteQuery } = require('../controllers/queryController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, getQueries) // Admin only
    .post(createQuery);       // Public submission

router.route('/:id')
    .delete(protect, deleteQuery); // Admin only

module.exports = router;
