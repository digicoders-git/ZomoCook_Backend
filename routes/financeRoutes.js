const express = require('express');
const router = express.Router();
const { getFinanceStats } = require('../controllers/financeController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getFinanceStats);

module.exports = router;
