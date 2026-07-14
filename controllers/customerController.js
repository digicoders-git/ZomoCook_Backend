const Customer = require('../models/Customer');
const Job = require('../models/Job');
const Application = require('../models/Application');
const Transaction = require('../models/Transaction');
const SubscriptionHistory = require('../models/SubscriptionHistory');
const Booking = require('../models/Booking');

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
        const isManager = req.admin.role && ['manager', 'super admin', 'admin'].includes(req.admin.role.name.toLowerCase());
        const isInternalStaff = isSuperAdmin || (
            req.admin.role && 
            !['cook', 'user', 'customer'].includes(req.admin.role.name.toLowerCase())
        );

        if (!isInternalStaff) {
            query.createdBy = req.admin._id;
        } else if (!isSuperAdmin && !isManager) {
            // Restricted staff user — show customers associated with their assigned jobs
            const Job = require('../models/Job');
            const escapedName = req.admin.name ? req.admin.name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&').trim() : '';
            const escapedEmail = req.admin.email ? req.admin.email.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&').trim() : '';
            
            const assignedJobs = await Job.find({
                $or: [
                    { leadManager: req.admin._id.toString() },
                    { leadManager: new RegExp(`^\\s*${escapedName}\\s*$`, 'i') },
                    { leadManager: new RegExp(`^\\s*${escapedEmail}\\s*$`, 'i') }
                ]
            }).select('customer');
            
            const customerIds = [...new Set(assignedJobs.map(j => j.customer?.toString()).filter(Boolean))];
            query._id = { $in: customerIds };
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

/**
 * @desc    Get customer dashboard details
 * @route   GET /api/customers/:id/dashboard
 * @access  Private (Admin)
 */
const getCustomerDashboard = async (req, res) => {
    try {
        const customerId = req.params.id;
        
        // 1. Get Customer Basic Details
        const customer = await Customer.findById(customerId);
        if (!customer) {
            return res.status(404).json({ success: false, message: 'Customer not found' });
        }

        // 2. Get Jobs Posted by this Customer (looking by customerId or user createdBy ID)
        const jobs = await Job.find({ 
            $or: [
                { customer: customerId }, 
                { customer: customer.createdBy }, 
                { createdBy: customer.createdBy }
            ] 
        }).sort({ createdAt: -1 });

        // 3. Get Applications (Assigned Candidates)
        // Note: Application model has customer field, or we can find by job ids
        const jobIds = jobs.map(job => job._id);
        const applications = await Application.find({ 
            job: { $in: jobIds },
            status: { $in: ['Hired', 'Profile Reviewed', 'Package Selected', 'Package Paid', 'Demo Scheduled'] } 
        }).populate('candidate', 'name phone email profilePic').populate('job', 'title');

        // 4. Get Transactions
        const transactions = await Transaction.find({ 
            $or: [
                { customer: customerId }, 
                { customer: customer.createdBy },
                { userId: customer.createdBy }
            ],
            status: 'success'
        }).sort({ createdAt: -1 });

        const totalSpent = transactions.reduce((sum, txn) => sum + txn.amount, 0);

        // 5. Get Active Subscription/Package
        const activeSubscriptions = await SubscriptionHistory.find({
            $or: [
                { customer: customerId }, 
                { customer: customer.createdBy }
            ],
            status: 'Active'
        }).populate('plan');

        // 6. Get Bookings
        const bookings = await Booking.find({ job: { $in: jobIds } })
            .populate('cook', 'name profilePic')
            .populate('job', 'title')
            .sort({ createdAt: -1 });

        // 7. Assemble Recent Activity Timeline
        let recentActivity = [];
        jobs.forEach(job => recentActivity.push({ type: 'job_posted', date: job.createdAt, details: job }));
        applications.filter(app => app.status === 'Hired').forEach(app => recentActivity.push({ type: 'candidate_hired', date: app.updatedAt, details: app }));
        applications.filter(app => app.status === 'Demo Scheduled').forEach(app => recentActivity.push({ type: 'demo_scheduled', date: app.updatedAt, details: app }));
        transactions.forEach(txn => recentActivity.push({ type: 'payment_received', date: txn.createdAt, details: txn }));
        activeSubscriptions.forEach(sub => recentActivity.push({ type: 'package_renewed', date: sub.createdAt, details: sub }));

        recentActivity.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Limit to 20 recent activities
        recentActivity = recentActivity.slice(0, 20);

        res.status(200).json({
            success: true,
            dashboard: {
                customer,
                jobs,
                applications,
                transactions,
                bookings,
                activeSubscriptions,
                recentActivity,
                stats: {
                    totalJobs: jobs.length,
                    totalAssignedCandidates: applications.length,
                    totalBookings: bookings.length,
                    totalSpent
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Add note to customer
 * @route   POST /api/customers/:id/notes
 * @access  Private (Admin)
 */
const addCustomerNote = async (req, res) => {
    try {
        const { content } = req.body;
        if (!content) return res.status(400).json({ success: false, message: 'Note content is required' });

        const customer = await Customer.findById(req.params.id);
        if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });

        customer.notes.push({
            content,
            addedBy: req.admin.name || 'Admin',
            createdAt: Date.now()
        });

        await customer.save();

        res.status(200).json({ success: true, message: 'Note added successfully', notes: customer.notes });
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
    toggleCustomerStatus,
    getCustomerDashboard,
    addCustomerNote
};
