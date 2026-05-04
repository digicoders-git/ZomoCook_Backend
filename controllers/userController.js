const User = require('../models/User');

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
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const fieldsToUpdate = ['name', 'email', 'phone', 'role', 'status', 'jobActions'];
        fieldsToUpdate.forEach(field => {
            if (req.body[field] !== undefined) user[field] = req.body[field];
        });

        if (req.body.password) user.password = req.body.password;
        if (req.file) user.profilePic = req.file.path;

        await user.save();
        res.status(200).json({ success: true, message: 'User updated successfully', user });
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
