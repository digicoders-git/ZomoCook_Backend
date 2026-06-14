const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // 1. Check in Admin collection
            let account = await Admin.findById(decoded.id).select('-password').populate('role');
            
            // 2. If not found in Admin, check in User collection
            if (!account) {
                const User = require('../models/User');
                account = await User.findById(decoded.id).select('-password').populate('role');
            }

            if (!account) {
                return res.status(401).json({ success: false, message: 'Account not found' });
            }

            // Check if account is inactive
            const currentStatus = (account.status || 'Active').toLowerCase();
            if (currentStatus === 'inactive' || currentStatus === 'cancelled' || currentStatus === 'expired') {
                return res.status(401).json({ success: false, message: 'Your account has been deactivated. Access denied.' });
            }

            req.admin = account; // Keep it as req.admin for backward compatibility or change to req.user
            next();
        } catch (error) {
            return res.status(401).json({ success: false, message: 'Invalid token' });
        }
    } else {
        return res.status(401).json({ success: false, message: 'No token provided' });
    }
};

const admin = (req, res, next) => {
    if (req.admin && req.admin.type === 'admin') {
        next();
    } else {
        return res.status(403).json({ success: false, message: 'Admin access required' });
    }
};

module.exports = { protect, admin };
