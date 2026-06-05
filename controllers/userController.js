const User = require('../models/User');
const Otp = require('../models/Otp');
const Role = require('../models/Role');
const jwt = require('jsonwebtoken');

// Generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '365d',
    });
};

/**
 * @desc    Get all staff users
 * @route   GET /api/users
 * @access  Private
 */
exports.getUsers = async (req, res) => {
    try {
        const { search, role, status } = req.query;
        let query = {};
        if (search) {
            query.$or = [
                { name: new RegExp(search, 'i') },
                { email: new RegExp(search, 'i') },
                { phone: new RegExp(search, 'i') }
            ];
        }
        if (role) query.role = role;
        if (status) query.status = status;

        const users = await User.find(query).populate('role').sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: users.length, users });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get staff user by ID
 * @route   GET /api/users/:id
 * @access  Private
 */
exports.getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).populate('role');
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        res.status(200).json({ success: true, user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Create new staff user
 * @route   POST /api/users
 * @access  Private
 */
exports.createUser = async (req, res) => {
    try {
        const { name, email, phone, password, role, status, jobActions } = req.body;
        const userExists = await User.findOne({ email });
        if (userExists) return res.status(400).json({ success: false, message: 'User already exists' });

        const userData = { name, email, phone, password, role, status, jobActions };
        if (req.file) userData.profilePic = req.file.path;

        const user = await User.create(userData);
        res.status(201).json({ success: true, message: 'User created successfully', user });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Update staff user
 * @route   PUT /api/users/:id
 * @access  Private
 */
exports.updateUser = async (req, res) => {
    try {
        if (req.body.password) {
            const bcrypt = require('bcryptjs');
            const salt = await bcrypt.genSalt(10);
            req.body.password = await bcrypt.hash(req.body.password, salt);
        }
        
        if (req.file) req.body.profilePic = req.file.path;

        const updatedUser = await User.findByIdAndUpdate(req.params.id, req.body, { 
            new: true,
            runValidators: false 
        });

        if (!updatedUser) return res.status(404).json({ success: false, message: 'User not found' });

        res.status(200).json({ success: true, message: 'User updated successfully', user: updatedUser });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Delete staff user
 * @route   DELETE /api/users/:id
 * @access  Private
 */
exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        res.status(200).json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Send OTP to mobile number
 * @route   POST /api/admin/users/send-otp
 * @access  Public
 */
exports.sendOtp = async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) {
            return res.status(400).json({ success: false, message: 'Please provide a phone number' });
        }

        // Generate 6 digit random OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Delete any existing OTP for this phone
        await Otp.deleteMany({ phone });

        // Save OTP to database
        await Otp.create({ phone, otp });

        console.log(`[OTP Verification] Generated OTP for ${phone}: ${otp}`);

        res.status(200).json({
            success: true,
            message: 'OTP sent successfully',
            otp // Returning OTP directly for testing/development convenience
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Verify OTP and Register/Login
 * @route   POST /api/admin/users/verify-otp
 * @access  Public
 */
exports.verifyOtp = async (req, res) => {
    try {
        const { phone, otp, fcmToken, role: requestedRole } = req.body;
        if (!phone || !otp) {
            return res.status(400).json({ success: false, message: 'Please provide phone and OTP' });
        }

        // Default role to 'User' if not provided
        const roleName = requestedRole || 'User';

        // Find or create the Role document
        let roleDoc = await Role.findOne({ name: { $regex: new RegExp(`^${roleName}$`, 'i') } });
        if (!roleDoc) {
            roleDoc = await Role.create({ name: roleName });
        }

        // Find the latest OTP record
        const otpRecord = await Otp.findOne({ phone, otp });
        if (!otpRecord) {
            return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
        }

        // OTP verified, delete it
        await Otp.deleteOne({ _id: otpRecord._id });

        // Check if user already exists
        let user = await User.findOne({ phone }).populate('role');
        let isNewUser = false;

        if (!user) {
            isNewUser = true;
            // First time user, register
            const defaultName = roleDoc.name.toLowerCase() === 'cook' 
                ? `Cook_${phone.slice(-4)}` 
                : `User_${phone.slice(-4)}`;

            const userData = {
                phone,
                name: defaultName,
                status: 'Active',
                role: roleDoc._id
            };
            if (fcmToken) {
                userData.fcmToken = fcmToken;
            }
            user = await User.create(userData);
            // Populate role for response consistency
            user = await User.findById(user._id).populate('role');
        } else {
            // Existing user
            // If user has no role assigned, assign the requested role
            if (!user.role) {
                user.role = roleDoc._id;
                if (fcmToken) {
                    user.fcmToken = fcmToken;
                }
                await user.save();
                user = await User.findById(user._id).populate('role');
            } else {
                // If user has a role, verify that it matches the requested role (case-insensitive check)
                if (user.role.name.toLowerCase() !== roleDoc.name.toLowerCase()) {
                    return res.status(400).json({
                        success: false,
                        message: `This phone number is already registered as a ${user.role.name}.`
                    });
                }
                
                // Existing user, same role - update fcmToken if provided
                if (fcmToken) {
                    user.fcmToken = fcmToken;
                    await user.save();
                }
            }
        }

        // Check if user is active
        const currentStatus = (user.status || 'Active').toLowerCase();
        if (currentStatus === 'inactive' || currentStatus === 'cancelled' || currentStatus === 'expired') {
            return res.status(401).json({ success: false, message: 'Your account is currently inactive. Please contact Admin.' });
        }

        res.status(200).json({
            success: true,
            message: isNewUser ? 'User registered successfully' : 'Logged in successfully',
            isNewUser,
            token: generateToken(user._id),
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                profilePic: user.profilePic,
                role: user.role,
                status: user.status,
                fcmToken: user.fcmToken
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

