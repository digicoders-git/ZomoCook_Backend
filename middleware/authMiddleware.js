const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Role = require('../models/Role');

const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // 1. Check in Admin collection
            let accountType = 'admin';
            let account = await Admin.findById(decoded.id).select('-password').populate('role');
            
            // 2. If not found in Admin, check in User collection
            if (!account) {
                const User = require('../models/User');
                account = await User.findById(decoded.id).select('-password').populate('role');
                accountType = 'user';
            }

            if (!account) {
                return res.status(401).json({ success: false, message: 'Account not found' });
            }

            // Check if account is inactive
            const currentStatus = (account.status || 'Active').toLowerCase();
            if (currentStatus === 'inactive' || currentStatus === 'cancelled' || currentStatus === 'expired') {
                return res.status(401).json({ success: false, message: 'Your account has been deactivated. Access denied.' });
            }

            // Check if user session was force-logged out by admin
            if (account.forceLogoutAt && decoded.iat) {
                const tokenIssuedAtMs = decoded.iat * 1000;
                const forceLogoutAtMs = new Date(account.forceLogoutAt).getTime();
                if (tokenIssuedAtMs < (forceLogoutAtMs - 1000)) {
                    return res.status(401).json({ 
                        success: false, 
                        isForceLoggedOut: true,
                        message: 'Your session has been logged out by admin. Please log in again.' 
                    });
                }
            }

            req.admin = account; // Keep it as req.admin for backward compatibility or change to req.user
            req.admin.type = accountType;
            req.user = account;
            next();
        } catch (error) {
            return res.status(401).json({ success: false, message: 'Invalid token' });
        }
    } else {
        return res.status(401).json({ success: false, message: 'No token provided' });
    }
};

const admin = (req, res, next) => {
    if (req.admin) {
        if (req.admin.type === 'admin') {
            return next();
        }
        if (req.admin.role) {
            const roleName = (req.admin.role.name || '').trim().toLowerCase();
            if (!['user', 'customer', 'cook'].includes(roleName)) {
                return next();
            }
        }
    }
    return res.status(403).json({ success: false, message: 'Admin access required' });
};

module.exports = { protect, admin };
