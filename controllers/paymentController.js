const Razorpay = require('razorpay');
const crypto = require('crypto');
const Transaction = require('../models/Transaction');
const ServicePackagePayment = require('../models/ServicePackagePayment');
const Application = require('../models/Application');

const getRazorpay = () => new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/**
 * @desc    Create a razorpay order
 * @route   POST /api/payments/create-order
 * @access  Private
 * body: { amount, currency, type: 'job_post_fee'|'daily_job_advance'|'subscription'|'service_package', jobId?, planId?, applicationId?, packageType? }
 */
const createOrder = async (req, res) => {
    try {
        const { amount, currency = 'INR', type, jobId, planId, applicationId, packageType } = req.body;

        const razorpay = getRazorpay();
        const order = await razorpay.orders.create({
            amount: amount * 100,
            currency,
            receipt: 'receipt_' + Date.now(),
        });

        if (!order) return res.status(500).json({ success: false, message: 'Failed to create Razorpay order' });

        const isCustomer = req.admin.constructor.modelName === 'Customer';
        const txnData = {
            type: type || 'job_post_fee',
            amount,
            status: 'pending',
            razorpayOrderId: order.id,
            relatedJob: jobId || undefined,
            relatedPlan: planId || undefined,
            description: type === 'daily_job_advance' ? 'Daily job 25% advance' :
                type === 'subscription' ? 'Subscription purchase' :
                type === 'service_package' ? `${packageType} Service Package` :
                `Job post fee ₹${amount}`
        };
        if (isCustomer) txnData.customer = req.admin._id;
        else txnData.user = req.admin._id;

        const txn = await Transaction.create(txnData);

        res.status(200).json({ success: true, order, transactionId: txn._id });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Verify a razorpay payment
 * @route   POST /api/payments/verify
 * @access  Private
 * body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, type, planId?, jobId?, applicationId?, packageType? }
 */
const verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId, jobId, type, applicationId, packageType } = req.body;

        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(razorpay_order_id + '|' + razorpay_payment_id)
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            await Transaction.findOneAndUpdate(
                { razorpayOrderId: razorpay_order_id },
                { status: 'failed', razorpayPaymentId: razorpay_payment_id }
            );
            return res.status(400).json({ success: false, message: 'Invalid signature. Payment verification failed' });
        }

        await Transaction.findOneAndUpdate(
            { razorpayOrderId: razorpay_order_id },
            { status: 'success', razorpayPaymentId: razorpay_payment_id }
        );

        let message = 'Payment verified successfully';

        // Handle service package payment
        if (type === 'service_package' && applicationId && packageType) {
            const ServicePackage = require('../models/ServicePackage');
            const servicePackage = await ServicePackage.findOne({ name: packageType, isActive: true });
            
            if (!servicePackage) {
                return res.status(404).json({ success: false, message: 'Service package not found' });
            }

            const application = await Application.findById(applicationId);
            if (!application) {
                return res.status(404).json({ success: false, message: 'Application not found' });
            }

            // Calculate support validity expiry date based on the package's supportDurationMonths (e.g. 3, 6, 11 months)
            const duration = servicePackage.supportDurationMonths || 3;
            const expiry = new Date();
            expiry.setMonth(expiry.getMonth() + duration);

            // Create service package payment record
            const packagePayment = await ServicePackagePayment.create({
                application: applicationId,
                customer: req.admin._id,
                packageType: packageType,
                amount: servicePackage.price,
                replacementLimit: servicePackage.replacementLimit,
                status: 'paid',
                razorpayOrderId: razorpay_order_id,
                razorpayPaymentId: razorpay_payment_id,
                paidDate: new Date(),
                supportExpiryDate: expiry
            });

            // Update application
            application.servicePackagePaymentId = packagePayment._id;
            application.servicePackagePaid = true;
            application.packagePaidDate = new Date();
            application.status = 'Package Paid';
            await application.save();

            message = `${packageType} Service Package payment confirmed. Demo can now be scheduled.`;

            // Notify customer
            const notificationController = require('./notificationController');
            notificationController.sendNotificationToUser({
                userId: req.admin._id,
                userModel: 'User',
                title: '💳 Service Package Payment Confirmed',
                message: `${packageType} package payment confirmed. You can now schedule a demo.`,
                type: 'payment',
                relatedId: application._id,
                relatedModel: 'Application',
                actionUrl: '/applications'
            }).catch(err => console.error('Error sending payment confirmation notification:', err));
        }

        // Handle subscription activation
        if (type === 'subscription' && planId) {
            const Plan = require('../models/Plan');
            const User = require('../models/User');
            const SubscriptionHistory = require('../models/SubscriptionHistory');

            const plan = await Plan.findById(planId);
            const isCustomer = req.admin.constructor.modelName === 'Customer';
            const UserModel = isCustomer ? require('../models/Customer') : User;
            const user = await UserModel.findById(req.admin._id);

            if (plan && user) {
                const expiry = new Date();
                expiry.setDate(expiry.getDate() + plan.durationDays);
                user.activePlan = plan._id;
                user.planExpiryDate = expiry;
                user.currentJobPostLimit = plan.jobPostLimit;
                user.jobsPostedInCurrentPlan = 0;
                user.currentHiringLimit = plan.hiringLimit;
                user.cooksHiredInCurrentPlan = 0;
                await user.save();

                await SubscriptionHistory.create({
                    user: isCustomer ? undefined : user._id,
                    customer: isCustomer ? user._id : undefined,
                    plan: plan._id,
                    amountPaid: plan.price,
                    startDate: new Date(),
                    endDate: expiry,
                    status: 'Active',
                    razorpayOrderId: razorpay_order_id,
                    razorpayPaymentId: razorpay_payment_id
                });
                message = 'Payment verified and Plan activated successfully';
            }
        }

        // Handle subscription activation for daily job advance if planId is passed
        if (type === 'daily_job_advance' && planId) {
            const Plan = require('../models/Plan');
            const User = require('../models/User');
            const SubscriptionHistory = require('../models/SubscriptionHistory');

            const plan = await Plan.findById(planId);
            const isCustomer = req.admin.constructor.modelName === 'Customer';
            const UserModel = isCustomer ? require('../models/Customer') : User;
            const user = await UserModel.findById(req.admin._id);

            if (plan && user) {
                const expiry = new Date();
                expiry.setDate(expiry.getDate() + plan.durationDays);
                user.activePlan = plan._id;
                user.planExpiryDate = expiry;
                user.currentJobPostLimit = plan.jobPostLimit;
                user.jobsPostedInCurrentPlan = 0;
                user.currentHiringLimit = plan.hiringLimit;
                user.cooksHiredInCurrentPlan = 0;
                await user.save();

                await SubscriptionHistory.create({
                    user: isCustomer ? undefined : user._id,
                    customer: isCustomer ? user._id : undefined,
                    plan: plan._id,
                    amountPaid: Math.round(plan.price * 0.25),
                    startDate: new Date(),
                    endDate: expiry,
                    status: 'Active',
                    razorpayOrderId: razorpay_order_id,
                    razorpayPaymentId: razorpay_payment_id
                });
            }
        }

        // Handle job post fee - activate the job
        if ((type === 'job_post_fee' || type === 'daily_job_advance') && jobId) {
            const Job = require('../models/Job');
            const updateData = {
                paymentStatus: 'paid',
                isActive: true,
                status: 'New',
                createdAt: new Date() // Reset creation time to when it was actually paid/posted
            };
            if (type === 'daily_job_advance') {
                const Job = require('../models/Job');
                const Plan = require('../models/Plan');
                let price = 0;
                if (planId) {
                    const planObj = await Plan.findById(planId);
                    if (planObj) price = planObj.price;
                }
                updateData.advanceAmount = Math.round((price > 0 ? price : 299) * 0.25);
            }
            await Job.findByIdAndUpdate(jobId, updateData);
            message = type === 'daily_job_advance' ? 'Advance paid and Plan activated. Daily job is now live.' : 'Job post fee paid. Job is now live.';
        }

        res.status(200).json({ success: true, message });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get transaction history for logged-in user
 * @route   GET /api/payments/transactions
 * @access  Private
 */
const getTransactionHistory = async (req, res) => {
    try {
        const { type, status, limit = 20, skip = 0 } = req.query;
        
        const isLeadManager = req.admin.role && req.admin.role.name && req.admin.role.name.toLowerCase().includes('lead manager');
        const isSuperAdmin = req.admin.constructor.modelName === 'Admin' && !isLeadManager;
        
        let query = {};
        if (isSuperAdmin) {
            query = {};
        } else if (isLeadManager) {
            const Job = require('../models/Job');
            const assignedJobs = await Job.find({
                $or: [
                    { leadManager: req.admin._id.toString() },
                    { leadManager: req.admin.name }
                ]
            }).select('_id');
            const jobIds = assignedJobs.map(j => j._id);
            
            query = {
                $or: [
                    { user: req.admin._id },
                    { relatedJob: { $in: jobIds } }
                ]
            };
        } else {
            const isCustomer = req.admin.constructor.modelName === 'Customer';
            query = isCustomer ? { customer: req.admin._id } : { user: req.admin._id };
        }

        if (type) query.type = type;
        if (status) query.status = status;

        const transactions = await Transaction.find(query)
            .populate('relatedJob', 'title jobCategory city')
            .populate('relatedPlan', 'name price')
            .populate('customer', 'name phone')
            .populate('user', 'name phone')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip));

        const total = await Transaction.countDocuments(query);

        res.status(200).json({ success: true, total, transactions });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const normalizeCategory = (cat) => {
    if (!cat) return '';
    const clean = cat.trim().toLowerCase();
    if (clean === 'commercial') return 'hotel';
    if (clean === 'domestic') return 'home';
    return clean;
};

/**
 * @desc    Check if user needs to pay for job post
 * @route   POST /api/payments/check-job-post
 * @access  Private
 * body: { jobCategory: 'hotel'|'home'|'daily' }
 */
const checkJobPostPayment = async (req, res) => {
    try {
        const { jobCategory } = req.body;
        const user = req.admin;
        const modelName = user.constructor.modelName;

        if (modelName === 'Admin') {
            return res.status(200).json({ success: true, requiresPayment: false, message: 'Admin can post for free' });
        }

        const UserModel = modelName === 'Customer' ? require('../models/Customer') : require('../models/User');
        const Plan = require('../models/Plan');
        const fullUser = await UserModel.findById(user._id).populate('activePlan');

        const reqCat = normalizeCategory(jobCategory);
        const hasActivePlan = fullUser.activePlan && fullUser.planExpiryDate && new Date(fullUser.planExpiryDate) > new Date();
        const planAllowsCategory = hasActivePlan && (
            !fullUser.activePlan.allowedJobCategories ||
            fullUser.activePlan.allowedJobCategories.length === 0 ||
            fullUser.activePlan.allowedJobCategories.map(c => normalizeCategory(c)).includes(reqCat)
        );

        const jobsPosted = fullUser.jobsPostedInCurrentPlan || 0;
        const postLimit = fullUser.currentJobPostLimit || 0;
        const withinLimit = planAllowsCategory && jobsPosted < postLimit;

        console.log('[DEBUG] checkJobPostPayment category check:');
        console.log('- User ID:', fullUser._id);
        console.log('- User Name:', fullUser.name);
        console.log('- jobCategory (requested):', jobCategory);
        console.log('- reqCat (normalized):', reqCat);
        console.log('- activePlan:', fullUser.activePlan ? {
            _id: fullUser.activePlan._id,
            name: fullUser.activePlan.name,
            allowedJobCategories: fullUser.activePlan.allowedJobCategories
        } : null);
        console.log('- planExpiryDate:', fullUser.planExpiryDate);
        console.log('- hasActivePlan:', hasActivePlan);
        console.log('- planAllowsCategory:', planAllowsCategory);
        console.log('- jobsPosted:', jobsPosted);
        console.log('- postLimit:', postLimit);
        console.log('- withinLimit:', withinLimit);

        if (withinLimit) {
            return res.status(200).json({
                success: true,
                requiresPayment: false,
                message: 'Free post available under your plan',
                remainingPosts: postLimit - jobsPosted
            });
        }

        if (reqCat === 'daily') {
            return res.status(200).json({
                success: true,
                requiresPayment: true,
                paymentType: 'daily_job_advance',
                advancePercent: 25,
                message: 'Daily job requires 25% advance payment'
            });
        }

        const WebSetting = require('../models/WebSetting');
        const settings = await WebSetting.findOne() || {};
        const feeAmount = settings.jobPostFee !== undefined ? settings.jobPostFee : 299;
        const isFeeActive = settings.jobPostFeeStatus !== undefined ? settings.jobPostFeeStatus : true;

        if (!isFeeActive) {
            return res.status(200).json({ success: true, requiresPayment: false });
        }

        return res.status(200).json({
            success: true,
            requiresPayment: true,
            paymentType: 'job_post_fee',
            amount: feeAmount,
            message: `Job post requires ₹${feeAmount} payment`
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get service package details and pricing
 * @route   GET /api/payments/service-packages
 * @access  Private
 */
const getServicePackages = async (req, res) => {
    try {
        const ServicePackage = require('../models/ServicePackage');
        // Fetch all packages (even inactive ones) for admin viewing
        const packages = await ServicePackage.find().sort({ price: 1 });

        res.status(200).json({
            success: true,
            packages
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Update a service package details
 * @route   PUT /api/payments/service-packages/:id
 * @access  Private (Admin)
 */
const updateServicePackage = async (req, res) => {
    try {
        const ServicePackage = require('../models/ServicePackage');
        const { price, replacementLimit, demoLimit, supportDurationMonths, features, description, isActive } = req.body;
        
        let pkg = await ServicePackage.findById(req.params.id);
        if (!pkg) {
            return res.status(404).json({ success: false, message: 'Service package not found' });
        }

        if (price !== undefined) pkg.price = Number(price);
        if (replacementLimit !== undefined) pkg.replacementLimit = Number(replacementLimit);
        if (demoLimit !== undefined) pkg.demoLimit = Number(demoLimit);
        if (supportDurationMonths !== undefined) pkg.supportDurationMonths = Number(supportDurationMonths);
        if (features !== undefined) pkg.features = features;
        if (description !== undefined) pkg.description = description;
        if (isActive !== undefined) pkg.isActive = isActive;

        await pkg.save();

        res.status(200).json({
            success: true,
            message: 'Service package updated successfully',
            package: pkg
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { createOrder, verifyPayment, getTransactionHistory, checkJobPostPayment, getServicePackages, updateServicePackage };
