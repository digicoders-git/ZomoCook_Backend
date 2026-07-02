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
    razorpayOrderId: {
        type: String
    },
    razorpayPaymentId: {
        type: String
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('SubscriptionHistory', subscriptionHistorySchema);
