const express = require('express');
const router = express.Router();
const { createOrder, verifyPayment, getTransactionHistory, checkJobPostPayment, getServicePackages, updateServicePackage } = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

router.post('/create-order', protect, createOrder);
router.post('/verify', protect, verifyPayment);
router.get('/transactions', protect, getTransactionHistory);
router.post('/check-job-post', protect, checkJobPostPayment);
router.get('/service-packages', protect, getServicePackages);
router.put('/service-packages/:id', protect, updateServicePackage);

module.exports = router;
