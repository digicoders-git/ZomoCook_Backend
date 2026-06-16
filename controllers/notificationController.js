const Notification = require('../models/Notification');
const Admin = require('../models/Admin');
const User = require('../models/User');
const admin = require('../config/firebase');
const fs = require('fs');

const deleteFile = (filePath) => {
    if (filePath && fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (e) { console.error('Error deleting file:', e); }
    }
};

// Helper: send FCM to all tokens with deep link
const sendFCMToAll = async (title, message, notificationType, relatedId, actionUrl) => {
    const [admins, users] = await Promise.all([
        Admin.find({ fcmToken: { $ne: null } }).select('fcmToken'),
        User.find({ fcmToken: { $ne: null } }).select('fcmToken')
    ]);
    const tokens = [...admins, ...users].map(u => u.fcmToken).filter(Boolean);
    if (!tokens.length) return;

    const payload = {
        notification: { 
            title, 
            body: message,
            clickAction: actionUrl || '/' // Deep link
        },
        data: {
            notificationType,
            relatedId: relatedId?.toString() || '',
            actionUrl: actionUrl || '/'
        }
    };

    try {
        await admin.messaging().sendEachForMulticast({
            tokens,
            notification: payload.notification,
            data: payload.data,
            webpush: {
                fcmOptions: {
                    link: actionUrl || '/'
                }
            }
        });
    } catch (err) {
        console.error('FCM Error:', err);
    }
};

/**
 * @desc    Get all notifications
 * @route   GET /api/notifications
 */
exports.getNotifications = async (req, res) => {
    try {
        const { search, status, limit = 50 } = req.query;
        let query = {};
        if (search) query.title = new RegExp(search, 'i');
        if (status) query.status = status;
        
        if (req.admin) {
            const isSuperAdmin = req.admin.constructor.modelName === 'Admin';
            if (!isSuperAdmin) {
                const userRole = req.admin.role?.name?.toLowerCase() || '';
                const targetRole = userRole === 'cook' ? 'candidates' : 'customers';

                query.$or = [
                    { recipient: req.admin._id },
                    { recipient: null, target: { $in: ['all', targetRole] } }
                ];
            }
        }
        
        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .populate('relatedId');
        
        res.status(200).json({ 
            success: true, 
            count: notifications.length, 
            notifications 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


/**
 * @desc    Create new notification + send FCM push
 * @route   POST /api/notifications
 */
exports.createNotification = async (req, res) => {
    try {
        const { title, message, type, relatedId, actionUrl, target, status } = req.body;
        const notificationData = { 
            title, 
            message, 
            type,
            relatedId,
            actionUrl,
            target, 
            status, 
            createdBy: req.admin?.id 
        };
        if (req.file) notificationData.image = req.file.path;

        const notification = await Notification.create(notificationData);

        // Send FCM push notification
        if (status !== 'inactive') {
            sendFCMToAll(title, message, type, relatedId, actionUrl)
                .catch(err => console.error('FCM Error:', err));
        }

        res.status(201).json({ 
            success: true, 
            message: 'Notification created successfully', 
            notification 
        });
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
        const notification = await Notification.findById(req.params.id)
            .populate('relatedId');
        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }
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
        const notification = await Notification.findByIdAndUpdate(
            req.params.id, 
            { status }, 
            { new: true }
        );
        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }
        res.status(200).json({ 
            success: true, 
            message: `Notification set to ${status}`, 
            notification 
        });
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
        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }
        if (notification.image) deleteFile(notification.image);
        await notification.deleteOne();
        res.status(200).json({ success: true, message: 'Notification deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Save FCM token for logged-in admin/user
 * @route   POST /api/notifications/save-token
 */
exports.saveFCMToken = async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) {
            return res.status(400).json({ success: false, message: 'Token required' });
        }

        if (req.admin) {
            if (req.admin.constructor.modelName === 'Admin') {
                await Admin.findByIdAndUpdate(req.admin._id || req.admin.id, { fcmToken: token });
            } else {
                await User.findByIdAndUpdate(req.admin._id || req.admin.id, { fcmToken: token });
            }
        }

        res.status(200).json({ success: true, message: 'FCM token saved' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.sendNotificationToUser = async ({
    userId,
    userModel = 'User',
    title,
    message,
    type,
    relatedId,
    relatedModel,
    actionUrl
}) => {
    try {
        let resolvedRecipientId = userId;
        let resolvedRecipientModel = userModel;
        let recipientDoc;

        if (userModel === 'Admin') {
            recipientDoc = await Admin.findById(userId).select('fcmToken');
        } else if (userModel === 'Candidate') {
            const Candidate = require('../models/Candidate');
            const candidateDoc = await Candidate.findById(userId);
            if (candidateDoc && candidateDoc.phone) {
                recipientDoc = await User.findOne({ phone: candidateDoc.phone }).select('fcmToken');
                if (recipientDoc) {
                    resolvedRecipientId = recipientDoc._id;
                    resolvedRecipientModel = 'User';
                }
            }
        } else {
            recipientDoc = await User.findById(userId).select('fcmToken');
            if (!recipientDoc) {
                // Try finding Candidate first, then find corresponding User
                const Candidate = require('../models/Candidate');
                const candidateDoc = await Candidate.findById(userId);
                if (candidateDoc && candidateDoc.phone) {
                    recipientDoc = await User.findOne({ phone: candidateDoc.phone }).select('fcmToken');
                    if (recipientDoc) {
                        resolvedRecipientId = recipientDoc._id;
                        resolvedRecipientModel = 'User';
                    }
                }
            }
        }

        const notification = await Notification.create({
            title,
            message,
            type,
            relatedId,
            relatedModel,
            actionUrl,
            target: 'all',
            recipient: resolvedRecipientId,
            recipientModel: resolvedRecipientModel,
            status: 'active'
        });

        if (recipientDoc && recipientDoc.fcmToken) {
            const payload = {
                notification: { title, body: message },
                data: {
                    notificationType: String(type || ''),
                    relatedId: String(relatedId || ''),
                    actionUrl: String(actionUrl || '/')
                }
            };
            console.log(`[FCM] Sending push notification to token: ${recipientDoc.fcmToken}`);
            await admin.messaging().send({
                token: recipientDoc.fcmToken,
                notification: payload.notification,
                data: payload.data
            });
            console.log('[FCM] Push notification sent successfully.');
        } else {
            console.log(`[FCM] No FCM token found for recipient: ${userId} (${userModel})`);
        }
        return notification;
    } catch (err) {
        console.error('Error in sendNotificationToUser:', err);
    }
};

// Helper: Send push notification to all users of a specific role (e.g. 'Cook') and save in database
exports.sendNotificationToRole = async ({
    roleName,
    title,
    message,
    type,
    relatedId,
    relatedModel,
    actionUrl
}) => {
    try {
        const target = roleName.toLowerCase() === 'cook' ? 'candidates' : 'customers';
        const notification = await Notification.create({
            title,
            message,
            type,
            relatedId,
            relatedModel,
            actionUrl,
            target,
            status: 'active'
        });

        const Role = require('../models/Role');
        const roleDoc = await Role.findOne({ name: { $regex: new RegExp(`^${roleName}$`, 'i') } });
        if (!roleDoc) {
            console.error(`Role ${roleName} not found`);
            return notification;
        }

        const users = await User.find({ role: roleDoc._id, fcmToken: { $ne: null } }).select('fcmToken');
        const tokens = users.map(u => u.fcmToken).filter(Boolean);

        if (tokens.length > 0) {
            const payload = {
                notification: { title, body: message },
                data: {
                    notificationType: type,
                    relatedId: relatedId?.toString() || '',
                    actionUrl: actionUrl || '/'
                }
            };

            await admin.messaging().sendEachForMulticast({
                tokens,
                notification: payload.notification,
                data: payload.data
            });
        }
        return notification;
    } catch (err) {
        console.error('Error in sendNotificationToRole:', err);
    }
};

