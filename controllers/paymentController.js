const Razorpay = require('razorpay');
const crypto = require('crypto');

/**
 * @desc    Create a razorpay order
 * @route   POST /api/payments/create-order
 * @access  Private
 */
const createOrder = async (req, res) => {
    try {
        const { amount, currency = 'INR' } = req.body;

        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });

        const options = {
            amount: amount * 100, // Amount is in currency subunits (paise)
            currency,
            receipt: 'receipt_' + Math.random().toString(36).substring(7),
        };

        const order = await razorpay.orders.create(options);

        if (!order) {
            return res.status(500).json({ success: false, message: 'Failed to create Razorpay order' });
        }

        res.status(200).json({
            success: true,
            order,
        });
    } catch (error) {
        console.error('Error creating razorpay order:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Verify a razorpay payment
 * @route   POST /api/payments/verify
 * @access  Private
 */
const verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        const body = razorpay_order_id + "|" + razorpay_payment_id;

        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');

        const isAuthentic = expectedSignature === razorpay_signature;

        if (isAuthentic) {
            // Payment verified successfully
            const { planId } = req.body;
            let message = 'Payment verified successfully';

            if (planId && req.admin && req.admin.constructor.modelName === 'User') {
                const Plan = require('../models/Plan');
                const User = require('../models/User');
                
                const plan = await Plan.findById(planId);
                const user = await User.findById(req.admin._id);

                if (plan && user) {
                    user.activePlan = plan._id;
                    const expiry = new Date();
                    expiry.setDate(expiry.getDate() + plan.durationDays);
                    user.planExpiryDate = expiry;
                    user.currentJobPostLimit = plan.jobPostLimit;
                    user.jobsPostedInCurrentPlan = 0; // Reset
                    user.currentHiringLimit = plan.hiringLimit;
                    user.cooksHiredInCurrentPlan = 0; // Reset
                    await user.save();
                    message = 'Payment verified and Plan activated successfully';
                }
            }

            res.status(200).json({
                success: true,
                message: message,
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Invalid signature. Payment verification failed',
            });
        }
    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createOrder,
    verifyPayment,
};
