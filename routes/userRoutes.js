const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { getUsers, createUser, updateUser, deleteUser, getUserById, sendOtp, verifyOtp, updateProfile } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

// Multer storage configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, `user-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ storage });

// Public Routes (OTP Login/Signup)
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);

router.use(protect);

router.put('/profile', upload.single('profilePic'), updateProfile);

router.route('/')
    .get(getUsers);

router.route('/:id')
    .get(getUserById)
    .put(upload.single('profilePic'), updateUser)
    .delete(deleteUser);

module.exports = router;
