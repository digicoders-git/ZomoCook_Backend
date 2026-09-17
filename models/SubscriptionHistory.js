const mongoose = require('mongoose');

const subscriptionHistorySchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer'
    },
    plan: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Plan',
        required: true
    },
    totalAmount: {
        type: Number
    },
    amountPaid: {
        type: Number,
        required: true,
        default: 0
    },
    dueAmount: {
        type: Number,
        default: 0
    },
    paymentStatus: {
        type: String,
        enum: ['paid', 'partial', 'pending'],
        default: 'paid'
    },
    customJobPostLimit: {
        type: Number
    },
    customHiringLimit: {
        type: Number
    },
    customReplacementLimit: {
        type: Number
    },
    paymentHistory: [{
        amount: { type: Number, required: true },
        paymentMethod: { type: String, default: 'cash' },
        paymentReference: { type: String, default: '' },
        paymentNote: { type: String, default: '' },
        collectedBy: { type: mongoose.Schema.Types.ObjectId, refPath: 'paymentHistory.collectedByModel' },
        collectedByModel: { type: String, enum: ['Admin', 'User'], default: 'Admin' },
        collectedByName: { type: String, default: '' },
        collectedAt: { type: Date, default: Date.now }
    }],
    startDate: {
        type: Date,
        default: Date.now
    },
    endDate: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['Active', 'Expired', 'Cancelled'],
        default: 'Active'
    },
    gateway: {
        type: String,
        default: 'cashfree'
    },
    orderId: {
        type: String
    },
    paymentId: {
        type: String
    },
    cfOrderId: {
        type: String
    },
    cfPaymentId: {
        type: String
    },
    razorpayOrderId: {
        type: String
    },
    razorpayPaymentId: {
        type: String
    },
    // Admin manual activation fields
    paymentMethod: {
        type: String,
        enum: ['cashfree', 'razorpay', 'cash', 'upi', 'bank_transfer', 'cheque', 'complimentary', 'other'],
        default: 'cashfree'
    },
    paymentReference: {
        type: String   // UPI txn ID, cheque no., bank ref, etc.
    },
    paymentNote: {
        type: String   // Admin's custom note e.g. "Collected by Rahul at office"
    },
    activatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'activatedByModel'
    },
    activatedByModel: {
        type: String,
        enum: ['Admin', 'User']
    },
    activationType: {
        type: String,
        enum: ['online', 'manual'],
        default: 'online'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('SubscriptionHistory', subscriptionHistorySchema);
