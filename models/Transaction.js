const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    type: {
        type: String,
        enum: ['job_post_fee', 'daily_job_advance', 'daily_job_remaining', 'subscription'],
        required: true
    },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
    razorpayOrderId: String,
    razorpayPaymentId: String,
    relatedJob: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
    relatedPlan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
    description: String
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
