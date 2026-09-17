const Plan = require('../models/Plan');
const jwt = require('jsonwebtoken');
const Customer = require('../models/Customer');
const User = require('../models/User');

// @desc    Get all active plans (standard plans + customer-specific custom plan if targeted)
// @route   GET /api/plans
// @access  Public / Authenticated
exports.getPlans = async (req, res) => {
    try {
        // 1. Standard active public plans
        const standardPlans = await Plan.find({ isActive: true, isCustom: { $ne: true } });

        // 2. Resolve customer ID if authenticated or provided
        let customerId = req.query.customerId || req.query.userId;
        
        if (!customerId && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            try {
                const token = req.headers.authorization.split(' ')[1];
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                if (decoded && decoded.id) {
                    const cust = await Customer.findOne({ $or: [{ _id: decoded.id }, { createdBy: decoded.id }] });
                    if (cust) {
                        customerId = cust._id;
                    } else {
                        customerId = decoded.id;
                    }
                }
            } catch (jwtErr) {
                // Ignore token decode error for public guest visitors
            }
        }

        let customPlans = [];
        if (customerId) {
            const now = new Date();
            customPlans = await Plan.find({
                isActive: true,
                isCustom: true,
                targetCustomer: customerId,
                isPublished: true,
                $or: [
                    { expiresAt: null },
                    { expiresAt: { $gt: now } }
                ]
            });
        }

        // Custom plan placed first so it highlights immediately on customer screen
        const allPlans = [...customPlans, ...standardPlans];

        res.status(200).json({ success: true, count: allPlans.length, data: allPlans });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

// @desc    Get all plans (including inactive and custom)
// @route   GET /api/plans/admin/all
// @access  Private/Admin
exports.getAllPlansAdmin = async (req, res) => {
    try {
        const plans = await Plan.find().populate('targetCustomer', 'name contactPhone email');
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
        const plan = await Plan.findById(req.params.id).populate('targetCustomer', 'name contactPhone email');
        if (!plan) {
            return res.status(404).json({ success: false, error: 'Plan not found' });
        }
        res.status(200).json({ success: true, data: plan });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

// @desc    Create a standard public plan
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

// @desc    Create / assign custom package for specific customer
// @route   POST /api/plans/customer/:customerId
// @access  Private/Admin / Lead Manager
exports.createCustomerCustomPlan = async (req, res) => {
    try {
        const { customerId } = req.params;
        const customer = await Customer.findById(customerId);
        if (!customer) {
            return res.status(404).json({ success: false, message: 'Customer not found' });
        }

        const {
            name,
            price,
            durationDays,
            jobPostLimit,
            hiringLimit,
            replacementLimit,
            features,
            allowedJobCategories,
            isPublished,
            customNotes,
            expiresAt,
            expiresInHours
        } = req.body;

        if (!name || !price || !durationDays) {
            return res.status(400).json({ success: false, message: 'Please provide name, price, and duration' });
        }

        let calculatedExpiresAt = null;
        if (expiresAt) {
            calculatedExpiresAt = new Date(expiresAt);
        } else if (expiresInHours && Number(expiresInHours) > 0) {
            calculatedExpiresAt = new Date(Date.now() + Number(expiresInHours) * 60 * 60 * 1000);
        }

        const planData = {
            name,
            price: Number(price),
            durationDays: Number(durationDays),
            jobPostLimit: Number(jobPostLimit || 0),
            hiringLimit: Number(hiringLimit || 0),
            replacementLimit: Number(replacementLimit || 0),
            features: Array.isArray(features) ? features : (features ? [features] : []),
            allowedJobCategories: allowedJobCategories || ['hotel', 'home', 'daily'],
            isCustom: true,
            targetCustomer: customerId,
            isPublished: isPublished === true || isPublished === 'true',
            isActive: true,
            customNotes: customNotes || '',
            expiresAt: calculatedExpiresAt,
            assignedBy: req.admin._id,
            assignedByModel: req.admin.constructor.modelName || 'Admin',
            createdBy: req.admin._id
        };

        const plan = await Plan.create(planData);

        res.status(201).json({
            success: true,
            message: plan.isPublished ? 'Custom Package created and published on App!' : 'Custom Package saved as Draft',
            data: plan
        });
    } catch (error) {
        console.error('Error creating custom plan:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Toggle publish status on app for a custom plan
// @route   PATCH /api/plans/:id/publish
// @access  Private/Admin
exports.togglePublishPlan = async (req, res) => {
    try {
        const plan = await Plan.findById(req.params.id);
        if (!plan) {
            return res.status(404).json({ success: false, message: 'Plan not found' });
        }

        if (req.body.expiresAt !== undefined) {
            plan.expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;
        } else if (req.body.expiresInHours && Number(req.body.expiresInHours) > 0) {
            plan.expiresAt = new Date(Date.now() + Number(req.body.expiresInHours) * 60 * 60 * 1000);
        }

        if (req.body.isPublished !== undefined) {
            plan.isPublished = req.body.isPublished === true || req.body.isPublished === 'true';
        } else {
            plan.isPublished = !plan.isPublished;
        }

        await plan.save();

        res.status(200).json({
            success: true,
            message: plan.isPublished ? 'Package is now published on App for customer' : 'Package unpublished from App',
            data: plan
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get custom plans for a specific customer
// @route   GET /api/plans/customer/:customerId
// @access  Private/Admin
exports.getPlansForCustomer = async (req, res) => {
    try {
        const plans = await Plan.find({
            isCustom: true,
            targetCustomer: req.params.customerId
        }).populate('assignedBy', 'name email').sort({ createdAt: -1 });

        res.status(200).json({ success: true, count: plans.length, data: plans });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
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

// @desc    Delete a plan
// @route   DELETE /api/plans/:id
// @access  Private/Admin
exports.deletePlan = async (req, res) => {
    try {
        const plan = await Plan.findById(req.params.id);

        if (!plan) {
            return res.status(404).json({ success: false, error: 'Plan not found' });
        }

        await Plan.findByIdAndDelete(req.params.id);

        res.status(200).json({ success: true, message: 'Plan deleted successfully', data: {} });
    } catch (error) {
        console.error(error);
        res.status(400).json({ success: false, error: error.message });
    }
};
