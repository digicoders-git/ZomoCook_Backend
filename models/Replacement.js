const mongoose = require('mongoose');

const replacementSchema = new mongoose.Schema({
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    category: {
        type: String,
        enum: ['Commercial', 'Domestic'],
        default: 'Domestic'
    },
    staffName: {
        type: String,
        required: true
    },
    reason: {
        type: String,
        required: true
    },
    details: {
        type: String,
        trim: true
    },
    status: {
        type: String,
        enum: ['Pending', 'In Progress', 'Resolved', 'Rejected'],
        default: 'Pending'
    },
    assignTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Replacement', replacementSchema);
