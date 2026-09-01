const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { getWebSettings, updateWebSettings, getAppVersion } = require('../controllers/webSettingController');
const { protect } = require('../middleware/authMiddleware');

// Public route to check app version & force update status
router.get('/app-version', getAppVersion);

// Protected routes for admin settings
router.get('/', protect, getWebSettings);

const uploadSettingsFiles = (req, res, next) => {
    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('multipart/form-data')) {
        upload.fields([
            { name: 'logo', maxCount: 1 },
            { name: 'favicon', maxCount: 1 }
        ])(req, res, next);
    } else {
        next();
    }
};

router.put('/', protect, uploadSettingsFiles, updateWebSettings);

module.exports = router;
