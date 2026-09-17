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
    amountPaid: {
        type: Number,
        required: true
    },
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
