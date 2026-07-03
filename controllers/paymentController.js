const Razorpay = require('razorpay');
const crypto = require('crypto');
const Transaction = require('../models/Transaction');

const getRazorpay = () => new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/**
 * @desc    Create a razorpay order
 * @route   POST /api/payments/create-order
 * @access  Private
 * body: { amount, currency, type: 'job_post_fee'|'daily_job_advance'|'subscription', jobId?, planId? }
 */
const createOrder = async (req, res) => {
    try {
        const { amount, currency = 'INR', type, jobId, planId } = req.body;

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
                type === 'subscription' ? 'Subscription purchase' : 'Job post fee ₹299'
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
 * body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, type, planId?, jobId? }
 */
const verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId, jobId, type } = req.body;

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

        // Update transaction to success
        await Transaction.findOneAndUpdate(
            { razorpayOrderId: razorpay_order_id },
            { status: 'success', razorpayPaymentId: razorpay_payment_id }
        );

        let message = 'Payment verified successfully';

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

        // Handle job post fee - activate the job
        if ((type === 'job_post_fee' || type === 'daily_job_advance') && jobId) {
            const Job = require('../models/Job');
            const updateData = {
                paymentStatus: 'paid',
                isActive: true,
                status: 'New'
            };
            if (type === 'daily_job_advance') {
                const job = await Job.findById(jobId);
                if (job) updateData.advanceAmount = Math.round(job.jobPostFee * 0.25);
            }
            await Job.findByIdAndUpdate(jobId, updateData);
            message = type === 'daily_job_advance' ? 'Advance paid. Daily job is now live.' : 'Job post fee paid. Job is now live.';
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
        const isCustomer = req.admin.constructor.modelName === 'Customer';
        const query = isCustomer ? { customer: req.admin._id } : { user: req.admin._id };
        if (type) query.type = type;
        if (status) query.status = status;

        const transactions = await Transaction.find(query)
            .populate('relatedJob', 'title jobCategory city')
            .populate('relatedPlan', 'name price')
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

        // No plan or limit exceeded or category not in plan
        if (reqCat === 'daily') {
            return res.status(200).json({
                success: true,
                requiresPayment: true,
                paymentType: 'daily_job_advance',
                advancePercent: 25,
                message: 'Daily job requires 25% advance payment'
            });
        }

        return res.status(200).json({
            success: true,
            requiresPayment: true,
            paymentType: 'job_post_fee',
            amount: 299,
            message: 'Job post requires ₹299 payment'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { createOrder, verifyPayment, getTransactionHistory, checkJobPostPayment };
