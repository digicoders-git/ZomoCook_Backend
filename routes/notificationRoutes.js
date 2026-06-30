const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const {
    getNotifications,
    createNotification,
    getNotification,
    toggleNotificationStatus,
    deleteNotification,
    saveFCMToken,
    markAllRead
} = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

// Multer storage configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, `notification-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ storage });

// Protected routes
router.use(protect);

router.post('/save-token', saveFCMToken);
router.post('/mark-all-read', markAllRead);
router.get('/', getNotifications);

router.post('/', upload.single('image'), createNotification);

router.route('/:id')
    .get(getNotification)
    .delete(deleteNotification);

router.patch('/:id/status', toggleNotificationStatus);

module.exports = router;
