const mongoose = require('mongoose');

const servicePackagePaymentSchema = new mongoose.Schema({
    application: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Application',
        required: true
    },
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    packageType: {
        type: String,
        enum: ['Basic', 'Standard', 'Premium'],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    replacementLimit: {
        type: Number,
        required: true
    },
    replacementsUsed: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['pending', 'paid', 'failed'],
        default: 'pending'
    },
    razorpayOrderId: String,
    razorpayPaymentId: String,
    paidDate: Date,
    supportExpiryDate: Date,
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model('ServicePackagePayment', servicePackagePaymentSchema);
