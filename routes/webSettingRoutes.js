const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { getWebSettings, updateWebSettings } = require('../controllers/webSettingController');
const { protect } = require('../middleware/authMiddleware');

// Multer storage configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, `setting-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ storage });

router.get('/', protect, getWebSettings);
router.put('/', protect, upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'favicon', maxCount: 1 }
]), updateWebSettings);

module.exports = router;
