const Booking = require('../models/Booking');
const Job = require('../models/Job');

/**
 * @desc    Create booking (when cook is hired)
 * @route   POST /api/bookings
 * @access  Private (Customer)
 */
const createBooking = async (req, res) => {
    try {
        const { jobId, cookId, amount, duration } = req.body;
        const customerId = req.admin._id;

        const job = await Job.findById(jobId);
        if (!job) return res.status(404).json({ success: false, message: 'Job not found' });

        const bookingData = {
            job: jobId,
            customer: customerId,
            cook: cookId,
            totalAmount: amount,
            duration,
            status: 'confirmed',
            createdAt: new Date()
        };

        const booking = await Booking.create(bookingData);
        await booking.populate('job cook customer');

        res.status(201).json({
            success: true,
            message: 'Booking created successfully',
            booking
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get all bookings for customer/cook
 * @route   GET /api/bookings
 * @access  Private
 */
const getBookings = async (req, res) => {
    try {
        const { status } = req.query;
        const userId = req.admin._id;
        const userModel = req.admin.constructor.modelName;

        let query = {};
        
        // Filter based on role
        if (userModel === 'User') {
            // Customer viewing their bookings
            query.customer = userId;
        } else if (req.admin.role?.name?.toLowerCase() === 'cook') {
            // Cook viewing their bookings
            query.cook = userId;
        }

        if (status) query.status = status;

        const bookings = await Booking.find(query)
            .populate('job cook customer')
            .sort({ createdAt: -1 });

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
 * @desc    Get single booking
 * @route   GET /api/bookings/:id
 * @access  Private
 */
const getBooking = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id)
            .populate('job cook customer');

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        res.status(200).json({
            success: true,
            booking
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Update booking status
 * @route   PUT /api/bookings/:id
 * @access  Private
 */
const updateBooking = async (req, res) => {
    try {
        const { status, remarks } = req.body;

        const booking = await Booking.findByIdAndUpdate(
            req.params.id,
            { status, remarks },
            { new: true }
        ).populate('job cook customer');

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        res.status(200).json({
            success: true,
            message: 'Booking updated successfully',
            booking
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Cancel booking
 * @route   DELETE /api/bookings/:id
 * @access  Private
 */
const cancelBooking = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        await Booking.findByIdAndUpdate(
            req.params.id,
            { status: 'cancelled' },
            { new: true }
        );

        res.status(200).json({
            success: true,
            message: 'Booking cancelled successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createBooking,
    getBookings,
    getBooking,
    updateBooking,
    cancelBooking
};
