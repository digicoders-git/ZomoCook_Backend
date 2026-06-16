const Booking = require('../models/Booking');
const Job = require('../models/Job');
const Candidate = require('../models/Candidate');

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
        if (req.admin.role && req.admin.role.name && req.admin.role.name.toLowerCase() === 'cook') {
            // Cook viewing their bookings
            const candidate = await Candidate.findOne({
                $or: [
                    { _id: userId },
                    { createdBy: userId },
                    { phone: req.admin.phone }
                ]
            });
            if (candidate) {
                query.cook = candidate._id;
            } else {
                return res.status(200).json({ success: true, count: 0, bookings: [] });
            }
        } else if (userModel === 'User') {
            // Customer viewing their bookings
            query.customer = userId;
        }

        if (status) {
            const lowerStatus = status.toLowerCase();
            if (lowerStatus === 'upcoming') {
                query.status = { $in: ['pending', 'confirmed', 'in-progress'] };
            } else {
                query.status = lowerStatus;
            }
        }

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

        // Notify cook about booking update
        if (booking.cook) {
            const notificationController = require('./notificationController');
            notificationController.sendNotificationToUser({
                userId: booking.cook._id,
                userModel: 'Candidate',
                title: '📅 Booking Updated',
                message: `Your booking for job "${booking.job?.title || 'Cooking'}" status has been updated to "${status}".`,
                type: 'booking',
                relatedId: booking._id,
                relatedModel: 'Booking',
                actionUrl: '/bookings'
            }).catch(err => console.error('Error sending booking update push notification:', err));
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
        let booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        booking = await Booking.findByIdAndUpdate(
            req.params.id,
            { status: 'cancelled' },
            { new: true }
        ).populate('job cook customer');

        // Notify cook about booking cancellation
        if (booking.cook) {
            const notificationController = require('./notificationController');
            notificationController.sendNotificationToUser({
                userId: booking.cook._id,
                userModel: 'Candidate',
                title: '⚠️ Booking Cancelled',
                message: `Your booking for job "${booking.job?.title || 'Cooking'}" has been cancelled.`,
                type: 'booking',
                relatedId: booking._id,
                relatedModel: 'Booking',
                actionUrl: '/bookings'
            }).catch(err => console.error('Error sending booking cancellation push notification:', err));
        }

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
