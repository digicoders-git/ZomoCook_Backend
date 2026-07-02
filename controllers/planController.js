const Plan = require('../models/Plan');

// @desc    Get all active plans
// @route   GET /api/plans
// @access  Public
exports.getPlans = async (req, res) => {
    try {
        const plans = await Plan.find({ isActive: true });
        res.status(200).json({ success: true, count: plans.length, data: plans });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

// @desc    Get single plan by ID
// @route   GET /api/plans/:id
// @access  Private/Admin
exports.getPlan = async (req, res) => {
    try {
        const plan = await Plan.findById(req.params.id);
        if (!plan) {
            return res.status(404).json({ success: false, error: 'Plan not found' });
        }
        res.status(200).json({ success: true, data: plan });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

// @desc    Create a new plan
// @route   POST /api/plans
// @access  Private/Admin
exports.createPlan = async (req, res) => {
    try {
        req.body.createdBy = req.admin._id;
        const plan = await Plan.create(req.body);
        res.status(201).json({ success: true, data: plan });
    } catch (error) {
        console.error(error);
        res.status(400).json({ success: false, error: error.message });
    }
};

// @desc    Update a plan
// @route   PUT /api/plans/:id
// @access  Private/Admin
exports.updatePlan = async (req, res) => {
    try {
        let plan = await Plan.findById(req.params.id);

        if (!plan) {
            return res.status(404).json({ success: false, error: 'Plan not found' });
        }

        plan = await Plan.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        res.status(200).json({ success: true, data: plan });
    } catch (error) {
        console.error(error);
        res.status(400).json({ success: false, error: error.message });
    }
};

// @desc    Delete/Deactivate a plan
// @route   DELETE /api/plans/:id
// @access  Private/Admin
exports.deletePlan = async (req, res) => {
    try {
        const plan = await Plan.findById(req.params.id);

        if (!plan) {
            return res.status(404).json({ success: false, error: 'Plan not found' });
        }

        // Instead of hard deleting, we might just deactivate it so history is maintained
        plan.isActive = false;
        await plan.save();

        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        console.error(error);
        res.status(400).json({ success: false, error: error.message });
    }
};
