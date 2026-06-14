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
    isActive: {
        type: Boolean,
        default: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Plan', PlanSchema);
