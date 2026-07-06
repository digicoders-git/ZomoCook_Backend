const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const {
    createCustomer,
    getCustomers,
    getCustomer,
    updateCustomer,
    deleteCustomer,
    toggleCustomerStatus,
    getCustomerDashboard
} = require('../controllers/customerController');
const { protect } = require('../middleware/authMiddleware');

// Multer storage configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, `customer-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ storage: storage });

// All routes are protected by admin auth
router.use(protect);

router.route('/')
    .get(getCustomers)
    .post(upload.single('profilePic'), createCustomer);

router.route('/:id')
    .get(getCustomer)
    .put(upload.single('profilePic'), updateCustomer)
    .delete(deleteCustomer);

router.get('/:id/dashboard', getCustomerDashboard);

router.patch('/:id/status', toggleCustomerStatus);

module.exports = router;
