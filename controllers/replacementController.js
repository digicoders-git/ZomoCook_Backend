const Replacement = require('../models/Replacement');
const User = require('../models/User');

// @desc    Create a new replacement request
// @route   POST /api/replacements
// @access  Private (Customer/User)
exports.createReplacement = async (req, res) => {
    try {
        const { staffName, reason, details } = req.body;
        
        // Find user to get category
        const user = await User.findById(req.admin._id);
        const category = user && user.propertyCategory && user.propertyCategory.toLowerCase().includes('hotel') ? 'Commercial' : 'Domestic';

        const replacement = await Replacement.create({
            customer: req.admin._id,
            category,
            staffName,
            reason,
            details,
            status: 'Pending'
        });

        res.status(201).json({
            success: true,
            data: replacement,
            message: 'Replacement request submitted successfully.'
        });
    } catch (error) {
        console.error('Error creating replacement:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Get all replacements
// @route   GET /api/replacements
// @access  Private (Admin)
exports.getReplacements = async (req, res) => {
    try {
        const replacements = await Replacement.find()
            .populate({
                path: 'customer',
                select: 'name phone address propertyCategory activePlan',
                populate: {
                    path: 'activePlan',
                    select: 'name duration'
                }
            })
            .populate('assignTo', 'name')
            .sort('-createdAt');

        res.status(200).json({
            success: true,
            data: replacements
        });
    } catch (error) {
        console.error('Error fetching replacements:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Update a replacement status or assign to
// @route   PUT /api/replacements/:id
// @access  Private (Admin)
exports.updateReplacement = async (req, res) => {
    try {
        const { status, assignTo } = req.body;
        
        const replacement = await Replacement.findById(req.params.id);
        
        if (!replacement) {
            return res.status(404).json({ success: false, message: 'Replacement request not found' });
        }
        
        if (status) replacement.status = status;
        if (assignTo) replacement.assignTo = assignTo;
        
        await replacement.save();
        
        res.status(200).json({
            success: true,
            data: replacement,
            message: 'Replacement request updated successfully.'
        });
    } catch (error) {
        console.error('Error updating replacement:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};
