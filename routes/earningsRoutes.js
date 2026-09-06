const express = require('express');
const router = express.Router();
const { getCookEarnings } = require('../controllers/earningsController');
const { protect } = require('../middleware/authMiddleware');

// Optional auth middleware (can work with or without token)
router.get('/', (req, res, next) => {
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        return protect(req, res, next);
    }
    next();
}, getCookEarnings);

module.exports = router;
