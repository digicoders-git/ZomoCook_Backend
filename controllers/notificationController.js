const Notification = require('../models/Notification');
const fs = require('fs');

// Helper to delete file
const deleteFile = (filePath) => {
    if (filePath && fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (e) { console.error('Error deleting file:', e); }
    }
};

/**
 * @desc    Get all notifications
 * @route   GET /api/notifications
 */
exports.getNotifications = async (req, res) => {
    try {
        const { search, target, status } = req.query;
        let query = {};

        if (search) query.title = new RegExp(search, 'i');
        if (target) query.target = target;
        if (status) query.status = status;

        const notifications = await Notification.find(query).sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: notifications.length, notifications });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Create new notification
 * @route   POST /api/notifications
 */
exports.createNotification = async (req, res) => {
    try {
        const { title, message, target, status } = req.body;
        const notificationData = { title, message, target, status, createdBy: req.admin?.id };

        if (req.file) {
            notificationData.image = req.file.path;
        }

        const notification = await Notification.create(notificationData);
        res.status(201).json({ success: true, message: 'Notification created successfully', notification });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get single notification
 * @route   GET /api/notifications/:id
 */
exports.getNotification = async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id);
        if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
        res.status(200).json({ success: true, notification });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Toggle notification status
 * @route   PATCH /api/notifications/:id/status
 */
exports.toggleNotificationStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const notification = await Notification.findByIdAndUpdate(req.params.id, { status }, { new: true });
        if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
        res.status(200).json({ success: true, message: `Notification set to ${status}`, notification });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Delete notification
 * @route   DELETE /api/notifications/:id
 */
exports.deleteNotification = async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id);
        if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });

        if (notification.image) {
            deleteFile(notification.image);
        }

        await notification.deleteOne();
        res.status(200).json({ success: true, message: 'Notification deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
