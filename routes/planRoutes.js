const express = require('express');
const { getPlans, createPlan, updatePlan, deletePlan } = require('../controllers/planController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Anyone can get active plans (often need auth though, let's keep it protected for now to match other routes, or public if they view it before login)
router.get('/', getPlans); // Or protect it if needed: router.get('/', protect, getPlans);

// Admin only routes for managing plans
router.post('/', protect, createPlan);
router.put('/:id', protect, updatePlan);
router.delete('/:id', protect, deletePlan);

module.exports = router;
