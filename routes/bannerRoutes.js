const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const {
    createBanner,
    getBanners,
    getBanner,
    updateBanner,
    deleteBanner
} = require('../controllers/bannerController');
const { protect } = require('../middleware/authMiddleware');

// Multer storage configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, `banner-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ storage });

// Routes definition
router.route('/')
    .get(getBanners)
    .post(protect, upload.single('image'), createBanner);

router.route('/:id')
    .get(getBanner)
    .put(protect, upload.single('image'), updateBanner)
    .delete(protect, deleteBanner);

module.exports = router;
