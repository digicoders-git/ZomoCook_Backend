const express = require('express');
const router = express.Router();
const { createReplacement, getReplacements, updateReplacement } = require('../controllers/replacementController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
    .post(protect, createReplacement)
    .get(protect, getReplacements); // Assuming protect allows admins too

router.route('/:id')
    .put(protect, updateReplacement);

module.exports = router;
