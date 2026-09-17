const express = require('express');
const { 
    getPlans, 
    getPlan, 
    createPlan, 
    updatePlan, 
    deletePlan,
    createCustomerCustomPlan,
    togglePublishPlan,
    getPlansForCustomer,
    getAllPlansAdmin
} = require('../controllers/planController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/admin/all', protect, getAllPlansAdmin);
router.post('/customer/:customerId', protect, createCustomerCustomPlan);
router.get('/customer/:customerId', protect, getPlansForCustomer);
router.patch('/:id/publish', protect, togglePublishPlan);

router.get('/', getPlans);
router.get('/:id', protect, getPlan);
router.post('/', protect, createPlan);
router.put('/:id', protect, updatePlan);
router.delete('/:id', protect, deletePlan);

module.exports = router;
