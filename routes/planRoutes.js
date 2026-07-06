const express = require('express');
const { getPlans, getPlan, createPlan, updatePlan, deletePlan } = require('../controllers/planController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/admin/all', protect, require('../controllers/planController').getAllPlansAdmin);
router.get('/', getPlans);
router.get('/:id', protect, getPlan);
router.post('/', protect, createPlan);
router.put('/:id', protect, updatePlan);
router.delete('/:id', protect, deletePlan);

module.exports = router;
