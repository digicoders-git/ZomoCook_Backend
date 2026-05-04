const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { getUsers, createUser, updateUser, deleteUser, getUserById } = require('../controllers/userController');
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

router.use(protect);

router.route('/')
    .get(getUsers)
    .post(upload.single('profilePic'), createUser);

router.route('/:id')
    .get(getUserById)
    .put(upload.single('profilePic'), updateUser)
    .delete(deleteUser);

module.exports = router;
