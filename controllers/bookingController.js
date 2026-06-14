const Booking = require('../models/Booking');

/**
 * @desc    Get all bookings for the logged-in user
 * @route   GET /api/bookings
 * @access  Private
 */
const getMyBookings = async (req, res) => {
    try {
        const { status } = req.query;
        let query = {};

        // For employers, req.user or req.admin might be populated by auth middleware
        // The auth middleware in zomocook sets req.user for app users
        if (req.user) {
            query.employer = req.user._id;
        } else if (req.admin) {
            query.employer = req.admin._id;
        }

        if (status) {
            query.status = status;
        }

        const bookings = await Booking.find(query)
            .populate('candidate', 'name profileImage phone')
            .sort({ date: 1 });

        res.status(200).json({
            success: true,
            count: bookings.length,
            bookings
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Create a booking
 * @route   POST /api/bookings
 * @access  Private
 */
const createBooking = async (req, res) => {
    try {
        const employerId = req.user ? req.user._id : (req.admin ? req.admin._id : null);
        if (!employerId) {
            return res.status(401).json({ success: false, message: "Not authorized" });
        }

        const bookingData = {
            ...req.body,
            employer: employerId
        };

        const booking = await Booking.create(bookingData);

        res.status(201).json({
            success: true,
            message: "Booking created successfully",
            booking
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getMyBookings,
    createBooking
};
