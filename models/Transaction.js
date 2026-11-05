const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    type: {
        type: String,
        enum: [
            'job_post_fee',
            'daily_job_advance',
            'daily_job_remaining',
            'party_job_advance',
            'party_job_remaining',
            'job_remaining',
            'subscription',
            'subscription_due',
            'service_package'
        ],
        required: true
    },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
    gateway: { type: String, default: 'cashfree' },
    orderId: String,
    paymentId: String,
    paymentSessionId: String,
    cfOrderId: String,
    cfPaymentId: String,
    razorpayOrderId: String,
    razorpayPaymentId: String,
    relatedJob: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
    relatedPlan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
    description: String
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
