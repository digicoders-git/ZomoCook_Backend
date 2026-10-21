const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    cook: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Candidate'
    },
    cookUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    cookName: {
        type: String,
        trim: true,
        default: ''
    },
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    customerName: {
        type: String,
        trim: true,
        default: 'Customer'
    },
    customerPhone: {
        type: String,
        trim: true,
        default: ''
    },
    job: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Job'
    },
    bookingId: {
        type: String,
        trim: true,
        default: ''
    },
    role: {
        type: String,
        trim: true,
        default: 'Staff'
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    tags: [{
        type: String,
        trim: true
    }],
    comment: {
        type: String,
        trim: true,
        default: ''
    },
    status: {
        type: String,
        enum: ['approved', 'pending', 'rejected'],
        default: 'approved'
    }
}, {
    timestamps: true
});

// Indexes for fast lookup
reviewSchema.index({ cook: 1, createdAt: -1 });
reviewSchema.index({ cookUser: 1, createdAt: -1 });
reviewSchema.index({ job: 1, cook: 1 });
reviewSchema.index({ job: 1, cookName: 1 });

module.exports = mongoose.model('Review', reviewSchema);
