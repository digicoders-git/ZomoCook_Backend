const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { getMasters, createMaster, updateMaster, deleteMaster, bulkDeleteMasters } = require('../controllers/masterController');
const { protect } = require('../middleware/authMiddleware');

// Multer storage configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, `master-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ storage });

router.post('/bulk-delete', protect, bulkDeleteMasters);

router.route('/:category')
    .get((req, res, next) => {
        const publicCats = [
            'sliders', 'videos', 'cms', 'states', 'cities',
            'job-categories', 'job-positions', 'cuisines', 'salaries',
            'experiences', 'joining-types', 'time-ranges', 'leaves',
            'cooking-preferences', 'food-preferences', 'property-categories',
            'facilities', 'benefits', 'service-durations', 'gender-preferences',
            'events', 'meal-types', 'family-members'
        ];
        if (publicCats.includes(req.params.category)) return next();
        return protect(req, res, next);
    }, getMasters)
    .post(protect, upload.single('image'), createMaster);

router.route('/:id')
    .put(protect, upload.single('image'), updateMaster)
    .delete(protect, deleteMaster);

module.exports = router;
