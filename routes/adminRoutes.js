const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const {
    registerAdmin,
    loginAdmin,
    getAdminProfile,
    updateAdminProfile,
    changeAdminPassword
    
} = require('../controllers/adminController');
const { protect } = require('../middleware/authMiddleware');

// Multer storage configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, `admin-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ storage });

// Protected Routes (only authenticated admins can register new admins)
router.post('/register', registerAdmin);
router.post('/login', loginAdmin);

// Protected Routes
router.get('/profile', protect, getAdminProfile);
router.put('/profile', protect, upload.single('profilePic'), updateAdminProfile);
router.put('/change-password', protect, changeAdminPassword);
router.get('/subscriptions', protect, require('../controllers/adminSubscriptionController').getAllSubscriptions);

module.exports = router;
