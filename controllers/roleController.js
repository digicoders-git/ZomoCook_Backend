const Role = require('../models/Role');

const Admin = require('../models/Admin');
const User = require('../models/User');
exports.getRoles = async (req, res) => {
    try {
        const { search } = req.query;
        let query = {};
        if (search) query.name = new RegExp(search, 'i');

        const roles = await Role.find(query).sort({ createdAt: -1 });
        
        // Map to include user counts
        const rolesWithCounts = await Promise.all(roles.map(async (role) => {
            const userCount = await User.countDocuments({ role: role._id });
            return {
                ...role._doc,
                userCount
            };
        }));

        res.status(200).json({ success: true, count: rolesWithCounts.length, roles: rolesWithCounts });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getRoleById = async (req, res) => {
    try {
        const role = await Role.findById(req.params.id);
        if (!role) return res.status(404).json({ success: false, message: 'Role not found' });
        res.status(200).json({ success: true, role });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.createRole = async (req, res) => {
    try {
        const role = await Role.create(req.body);
        res.status(201).json({ success: true, message: 'Role created successfully', role });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.updateRole = async (req, res) => {
    try {
        const role = await Role.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!role) return res.status(404).json({ success: false, message: 'Role not found' });
        res.status(200).json({ success: true, message: 'Role updated successfully', role });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.deleteRole = async (req, res) => {
    try {
        const role = await Role.findByIdAndDelete(req.params.id);
        if (!role) return res.status(404).json({ success: false, message: 'Role not found' });
        res.status(200).json({ success: true, message: 'Role deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
