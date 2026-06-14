const express = require('express');
const router = express.Router();
const { getMyBookings, createBooking } = require('../controllers/bookingController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getMyBookings);
router.post('/', protect, createBooking);

module.exports = router;
