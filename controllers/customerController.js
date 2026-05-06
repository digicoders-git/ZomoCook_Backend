const Customer = require('../models/Customer');

/**
 * @desc    Create new customer
 * @route   POST /api/customers
 * @access  Private (Admin)
 */
const createCustomer = async (req, res) => {
    try {
        const {
            name,
            propertyCategory,
            email,
            password,
            contactName,
            contactPhone,
            contactAddress,
            customerStatus,
            accountStatus
        } = req.body;

        const customerExists = await Customer.findOne({ email });

        if (customerExists) {
            return res.status(400).json({ success: false, message: 'Customer with this email already exists' });
        }

        const customer = await Customer.create({
            name,
            propertyCategory,
            email,
            password,
            contactName,
            contactPhone,
            contactAddress,
            customerStatus,
            accountStatus,
            profilePic: req.file ? req.file.path : undefined,
            createdBy: req.admin._id,
            creatorModel: req.admin.constructor.modelName
        });

        res.status(201).json({
            success: true,
            message: "Customer created successfully",
            customer
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get all customers
 * @route   GET /api/customers
 * @access  Private (Admin)
 */
const getCustomers = async (req, res) => {
    try {
        let query = {};
        
        // Role-based data isolation
        const isSuperAdmin = req.admin.constructor.modelName === 'Admin';
        if (!isSuperAdmin) {
            query.createdBy = req.admin._id;
        }

        const customers = await Customer.find(query).sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            count: customers.length,
            customers
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get single customer
 * @route   GET /api/customers/:id
 * @access  Private (Admin)
 */
const getCustomer = async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.id);

        if (!customer) {
            return res.status(404).json({ success: false, message: 'Customer not found' });
        }

        res.status(200).json({
            success: true,
            customer
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Update customer
 * @route   PUT /api/customers/:id
 * @access  Private (Admin)
 */
const updateCustomer = async (req, res) => {
    try {
        let customer = await Customer.findById(req.params.id);

        if (!customer) {
            return res.status(404).json({ success: false, message: 'Customer not found' });
        }

        // Handle profile pic update
        if (req.file) {
            req.body.profilePic = req.file.path;
        }

        customer = await Customer.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        res.status(200).json({
            success: true,
            message: "Customer updated successfully",
            customer
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Delete customer
 * @route   DELETE /api/customers/:id
 * @access  Private (Admin)
 */
const deleteCustomer = async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.id);

        if (!customer) {
            return res.status(404).json({ success: false, message: 'Customer not found' });
        }

        await customer.deleteOne();

        res.status(200).json({
            success: true,
            message: "Customer deleted successfully"
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Toggle customer account status
 * @route   PATCH /api/customers/:id/status
 * @access  Private (Admin)
 */
const toggleCustomerStatus = async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.id);

        if (!customer) {
            return res.status(404).json({ success: false, message: 'Customer not found' });
        }

        const newStatus = customer.accountStatus === 'active' ? 'inactive' : 'active';
        await Customer.updateOne(
            { _id: req.params.id },
            { $set: { accountStatus: newStatus } }
        );

        res.status(200).json({
            success: true,
            message: `Account status updated to ${newStatus}`,
            accountStatus: newStatus
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createCustomer,
    getCustomers,
    getCustomer,
    updateCustomer,
    deleteCustomer,
    toggleCustomerStatus
};
