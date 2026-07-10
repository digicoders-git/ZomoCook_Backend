const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const User = require('../models/User');
const Role = require('../models/Role');

// Generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '365d',
    });
};

/**
 * @desc    Register a new admin
 * @route   POST /api/admin/register
 * @access  Public
 */
const registerAdmin = async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;
        const adminExists = await Admin.findOne({ email });
        if (adminExists) return res.status(400).json({ success: false, message: 'Admin already exists' });

        const admin = await Admin.create({ name, email, phone, password });

        if (admin) {
            res.status(201).json({
                success: true,
                _id: admin._id,
                name: admin.name,
                email: admin.email,
                phone: admin.phone,
                token: generateToken(admin._id),
            });
        } else {
            res.status(400).json({ success: false, message: 'Invalid admin data' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Admin/User login
 * @route   POST /api/admin/login
 * @access  Public
 */
const loginAdmin = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // 1. Check in Admin collection
        let account = await Admin.findOne({ email }).select('+password').populate('role');
        let type = 'admin';

        // 2. If not found in Admin, check in User collection
        if (!account) {
            account = await User.findOne({ email }).select('+password').populate('role');
            type = 'user';
        }

        if (account && (await account.matchPassword(password))) {
            // Check status
            const currentStatus = (account.status || 'Active').toLowerCase();
            if (currentStatus === 'inactive' || currentStatus === 'cancelled' || currentStatus === 'expired') {
                return res.status(401).json({ success: false, message: 'Your account is currently inactive. Please contact Super Admin.' });
            }

            res.json({
                success: true,
                _id: account._id,
                name: account.name,
                email: account.email,
                phone: account.phone,
                profilePic: account.profilePic,
                role: account.role, // includes permissions
                type: type,
                token: generateToken(account._id),
            });
        } else {
            res.status(401).json({ success: false, message: 'Invalid email or password' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getAdminProfile = async (req, res) => {
    try {
        let account = await Admin.findById(req.admin._id).populate('role');
        let type = 'admin';

        if (!account) {
            account = await User.findById(req.admin._id).populate('role');
            type = 'user';
        }

        if (account) {
            res.json({
                success: true,
                _id: account._id,
                name: account.name,
                email: account.email,
                phone: account.phone,
                profilePic: account.profilePic,
                role: account.role,
                type: type
            });
        } else {
            res.status(404).json({ success: false, message: 'Account not found' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Update admin profile
 * @route   PUT /api/admin/profile
 * @access  Private
 */
const updateAdminProfile = async (req, res) => {
    try {
        const admin = await Admin.findById(req.admin._id);
        if (admin) {
            const body = req.body || {};
            admin.name = body.name || admin.name;
            admin.email = body.email || admin.email;
            admin.phone = body.phone || admin.phone;
            if (req.file) admin.profilePic = req.file.path;
            const updatedAdmin = await admin.save();
            res.json({
                success: true,
                _id: updatedAdmin._id,
                name: updatedAdmin.name,
                email: updatedAdmin.email,
                phone: updatedAdmin.phone,
                profilePic: updatedAdmin.profilePic,
                token: generateToken(updatedAdmin._id),
            });
        } else {
            res.status(404).json({ success: false, message: 'Admin not found' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Change admin password
 * @route   PUT /api/admin/change-password
 * @access  Private
 */
const changeAdminPassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const admin = await Admin.findById(req.admin._id).select('+password');
        if (admin && (await admin.matchPassword(currentPassword))) {
            admin.password = newPassword;
            await admin.save();
            res.json({ success: true, message: 'Password changed successfully' });
        } else {
            res.status(401).json({ success: false, message: 'Invalid current password' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    registerAdmin,
    loginAdmin,
    getAdminProfile,
    updateAdminProfile,
    changeAdminPassword
};
