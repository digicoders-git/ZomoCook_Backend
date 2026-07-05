const mongoose = require('mongoose');

const servicePackageSchema = new mongoose.Schema({
    name: {
        type: String,
        enum: ['Basic', 'Standard', 'Premium'],
        required: true,
        unique: true
    },
    price: {
        type: Number,
        required: true
    },
    replacementLimit: {
        type: Number,
        required: true,
        description: 'Number of cook replacements allowed if customer rejects'
    },
    demoLimit: {
        type: Number,
        required: true,
        description: 'Number of demos allowed'
    },
    features: {
        type: [String],
        default: []
    },
    description: String,
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model('ServicePackage', servicePackageSchema);
