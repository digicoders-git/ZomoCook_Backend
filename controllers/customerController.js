const Customer = require('../models/Customer');
const Job = require('../models/Job');
const Application = require('../models/Application');
const Transaction = require('../models/Transaction');
const SubscriptionHistory = require('../models/SubscriptionHistory');
const Booking = require('../models/Booking');
const { hasPermission } = require('../middleware/permissionHelper');

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
            accountStatus,
            leadManager
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
            leadManager: leadManager || '',
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
        const roleName = (req.admin.role?.name || '').toLowerCase();
        const isSuperAdmin = (req.admin.constructor.modelName === 'Admin' && roleName !== 'lead manager') || 
            roleName === 'super admin';
        const isClient = req.admin.role && ['user', 'customer'].includes(roleName);

        if (isClient) {
            query.createdBy = req.admin._id;
        } else if (!isSuperAdmin) {
            // Staff User / Lead Manager — show only assigned customers
            const escapedName = req.admin.name ? req.admin.name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&').trim() : '';
            const escapedEmail = req.admin.email ? req.admin.email.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&').trim() : '';
            
            const Job = require('../models/Job');
            const assignedJobs = await Job.find({
                $or: [
                    { leadManager: req.admin._id.toString() },
                    { leadManager: new RegExp(`^\\s*${escapedName}\\s*$`, 'i') },
                    { leadManager: new RegExp(`^\\s*${escapedEmail}\\s*$`, 'i') }
                ]
            }).select('customer');
            
            const customerIdsFromJobs = [...new Set(assignedJobs.map(j => j.customer?.toString()).filter(Boolean))];

            query.$or = [
                { leadManager: req.admin._id.toString() },
                { leadManager: new RegExp(`^\\s*${escapedName}\\s*$`, 'i') },
                { leadManager: new RegExp(`^\\s*${escapedEmail}\\s*$`, 'i') },
                ...(customerIdsFromJobs.length > 0 ? [{ _id: { $in: customerIdsFromJobs } }] : [])
            ];
        }

        const { leadManager, search, status } = req.query;
        if (leadManager) {
            query.leadManager = leadManager;
        }
        if (status) {
            query.accountStatus = status;
        }
        if (search) {
            query.$and = query.$and || [];
            query.$and.push({
                $or: [
                    { name: new RegExp(search, 'i') },
                    { email: new RegExp(search, 'i') },
                    { contactPhone: new RegExp(search, 'i') }
                ]
            });
        }

        const customers = await Customer.find(query).sort({ createdAt: -1 });

        // Populate active package / subscription for each customer
        const customerIds = customers.map(c => c._id);
        const creatorIds = customers.map(c => c.createdBy).filter(Boolean);
        const allRelatedIds = [...new Set([...customerIds, ...creatorIds])];

        const now = new Date();
        const [activeSubs, allJobs, allTransactions] = await Promise.all([
            SubscriptionHistory.find({
                $or: [
                    { customer: { $in: allRelatedIds } },
                    { user: { $in: allRelatedIds } }
                ],
                status: 'Active',
                endDate: { $gt: now }
            }).populate('plan').sort({ createdAt: -1 }),
            Job.find({
                $or: [
                    { customer: { $in: allRelatedIds } },
                    { createdBy: { $in: allRelatedIds } }
                ]
            }).sort({ createdAt: -1 }),
            Transaction.find({
                $or: [
                    { customer: { $in: allRelatedIds } },
                    { user: { $in: allRelatedIds } }
                ],
                status: 'success'
            }).sort({ createdAt: -1 })
        ]);

        const allJobIds = allJobs.map(j => j._id);
        const allApps = await Application.find({
            $or: [
                { job: { $in: allJobIds } },
                { customer: { $in: allRelatedIds } }
            ]
        }).sort({ updatedAt: -1 });

        const customersWithPackages = customers.map(cust => {
            const custObj = cust.toObject();
            const relIds = [cust._id.toString(), cust.createdBy ? cust.createdBy.toString() : null].filter(Boolean);

            const matchingSub = activeSubs.find(sub => 
                (sub.customer && relIds.includes(sub.customer.toString())) ||
                (sub.user && relIds.includes(sub.user.toString()))
            );

            if (matchingSub && matchingSub.plan) {
                const totalVal = matchingSub.totalAmount ?? matchingSub.plan.price ?? matchingSub.amountPaid ?? 0;
                const paidVal = matchingSub.amountPaid ?? 0;
                const dueVal = matchingSub.dueAmount ?? Math.max(0, totalVal - paidVal);

                custObj.activePackage = {
                    subId: matchingSub._id,
                    planId: matchingSub.plan._id,
                    name: matchingSub.plan.name,
                    price: totalVal,
                    totalAmount: totalVal,
                    amountPaid: paidVal,
                    dueAmount: dueVal,
                    paymentStatus: matchingSub.paymentStatus || (dueVal === 0 ? 'paid' : 'partial'),
                    startDate: matchingSub.startDate,
                    endDate: matchingSub.endDate,
                    durationDays: matchingSub.plan.durationDays,
                    daysLeft: Math.max(0, Math.ceil((new Date(matchingSub.endDate) - now) / (1000 * 3600 * 24))),
                    status: matchingSub.status,
                    isCustom: matchingSub.plan.isCustom || false
                };
            } else {
                custObj.activePackage = null;
            }

            // Customer Jobs & Apps
            const custJobs = allJobs.filter(j => 
                (j.customer && relIds.includes(j.customer.toString())) ||
                (j.createdBy && relIds.includes(j.createdBy.toString()))
            );
            const custJobIds = custJobs.map(j => j._id.toString());
            const custApps = allApps.filter(a => 
                (a.job && custJobIds.includes(a.job.toString())) ||
                (a.customer && relIds.includes(a.customer.toString()))
            );
            const custTxns = allTransactions.filter(t =>
                (t.customer && relIds.includes(t.customer.toString())) ||
                (t.user && relIds.includes(t.user.toString()))
            );

            // Calculate Lead Type: Paid if they have any successful transaction or active package, else Unpaid
            custObj.leadType = (custTxns.length > 0 || custObj.activePackage) ? 'Paid' : 'Unpaid';

            // Calculate Lead Status based on latest application / job progress
            let computedLeadStatus = 'New Lead';
            if (custApps.some(a => ['Hired', 'Joined'].includes(a.status))) {
                computedLeadStatus = 'Hired';
            } else if (custApps.some(a => ['Demo Scheduled', 'Demo In Progress', 'Demo Completed'].includes(a.status))) {
                computedLeadStatus = 'Demo';
            } else if (custApps.some(a => ['Shortlisted', 'Profile Reviewed'].includes(a.status))) {
                computedLeadStatus = 'Shortlisted';
            } else if (custApps.some(a => ['Package Selected', 'Package Paid'].includes(a.status))) {
                computedLeadStatus = 'Selected';
            } else if (custApps.some(a => ['Rejected', 'Offer Rejected', 'Cancelled'].includes(a.status))) {
                computedLeadStatus = 'Rejected';
            } else if (custJobs.length > 0) {
                computedLeadStatus = 'Job Posted';
            }
            custObj.leadStatus = computedLeadStatus;

            // Calculate Latest Activity
            let activities = [];
            if (custTxns.length > 0) {
                activities.push({ date: new Date(custTxns[0].createdAt), title: 'Payment received', desc: `₹${custTxns[0].amount}` });
            }
            if (custApps.length > 0) {
                activities.push({ date: new Date(custApps[0].updatedAt || custApps[0].createdAt), title: custApps[0].status, desc: `Candidate ${custApps[0].status}` });
            }
            if (custJobs.length > 0) {
                activities.push({ date: new Date(custJobs[0].createdAt), title: 'Job posted', desc: custJobs[0].title || 'Requirements added' });
            }
            activities.push({ date: new Date(cust.createdAt), title: 'Customer registered', desc: 'Account created' });
            activities.sort((a, b) => b.date - a.date);

            custObj.latestActivity = activities[0];

            return custObj;
        });

        res.status(200).json({
            success: true,
            count: customersWithPackages.length,
            customers: customersWithPackages
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
            status: { $in: ['Hired', 'Profile Reviewed', 'Package Selected', 'Package Paid', 'Demo Scheduled', 'Demo In Progress', 'Demo Completed'] } 
        }).populate('candidate', 'name phone email profilePic').populate('job', 'title');

        // 4. Get Transactions
        const transactions = await Transaction.find({ 
            $or: [
                { customer: customerId }, 
                { customer: customer.createdBy },
                { user: customer.createdBy }
            ],
            status: 'success'
        }).sort({ createdAt: -1 });

        const totalSpent = transactions.reduce((sum, txn) => sum + txn.amount, 0);

        // 5. Get Active Subscription/Package
        const Plan = require('../models/Plan');
        const User = require('../models/User');

        const relatedUserIds = [customerId];
        if (customer.createdBy) relatedUserIds.push(customer.createdBy);
        if (customer.contactPhone) {
            const linkedUser = await User.findOne({ phone: customer.contactPhone });
            if (linkedUser) relatedUserIds.push(linkedUser._id);
        }

        const activeSubscriptions = await SubscriptionHistory.find({
            $or: [
                { customer: { $in: relatedUserIds } }, 
                { user: { $in: relatedUserIds } }
            ]
        }).populate('plan').populate('activatedBy', 'name email').sort({ createdAt: -1 });

        // Get Custom Packages created for this specific customer
        const customPlans = await Plan.find({
            isCustom: true,
            targetCustomer: customerId
        }).populate('assignedBy', 'name email').sort({ createdAt: -1 });

        // 6. Get Bookings
        const bookings = await Booking.find({ job: { $in: jobIds } })
            .populate('cook', 'name profilePic')
            .populate('job', 'title')
            .sort({ createdAt: -1 });

        // 7. Assemble Recent Activity Timeline
        let recentActivity = [];
        jobs.forEach(job => recentActivity.push({ type: 'job_posted', date: job.createdAt, details: job }));
        applications.filter(app => app.status === 'Hired').forEach(app => recentActivity.push({ type: 'candidate_hired', date: app.updatedAt, details: app }));
        applications.filter(app => ['Demo Scheduled', 'Demo In Progress', 'Demo Completed'].includes(app.status)).forEach(app => recentActivity.push({ type: 'demo_scheduled', date: app.updatedAt, details: app }));
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
                customPlans,
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
