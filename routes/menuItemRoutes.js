const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `menu-item-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/') || file.originalname.match(/\.(jpg|jpeg|png|webp|gif|svg|jfif)$/i)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (jpg, jpeg, png, webp) are allowed'), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter
});

const {
  getMenuItems,
  getActiveMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  seedMenuItems,
  uploadMenuItemImage
} = require('../controllers/menuItemController');

router.route('/')
  .get(getMenuItems)
  .post(upload.single('image'), createMenuItem);

router.route('/active')
  .get(getActiveMenuItems);

router.route('/seed')
  .post(seedMenuItems);

router.route('/upload')
  .post(upload.single('image'), uploadMenuItemImage);

router.route('/:id')
  .put(upload.single('image'), updateMenuItem)
  .delete(deleteMenuItem);

module.exports = router;

