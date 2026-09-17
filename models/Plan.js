const mongoose = require('mongoose');

const PlanSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a plan name']
    },
    price: {
        type: Number,
        required: [true, 'Please add a price']
    },
    durationDays: {
        type: Number,
        required: [true, 'Please add validity in days']
    },
    jobPostLimit: {
        type: Number,
        required: [true, 'Please add job posting limit']
    },
    hiringLimit: {
        type: Number,
        required: [true, 'Please add hiring limit']
    },
    features: {
        type: [String],
        default: []
    },
    isPopular: {
        type: Boolean,
        default: false
    },
    isBestValue: {
        type: Boolean,
        default: false
    },
    allowedJobCategories: {
        type: [String],
        enum: ['hotel', 'home', 'daily'],
        default: []
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isCustom: {
        type: Boolean,
        default: false
    },
    targetCustomer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        default: null
    },
    isPublished: {
        type: Boolean,
        default: false
    },
    replacementLimit: {
        type: Number,
        default: 0
    },
    customNotes: {
        type: String,
        default: ''
    },
    expiresAt: {
        type: Date,
        default: null
    },
    assignedBy: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'assignedByModel'
    },
    assignedByModel: {
        type: String,
        enum: ['Admin', 'User']
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Plan', PlanSchema);
