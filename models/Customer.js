const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const customerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a customer name']
    },
    propertyCategory: {
        type: String,
        required: false
    },
    email: {
        type: String,
        unique: true,
        sparse: true,
        required: false
    },
    password: {
        type: String,
        select: false,
        required: false
    },
    contactName: {
        type: String,
        required: false
    },
    contactPhone: {
        type: String,
        required: false
    },
    contactAddress: {
        type: String,
        required: false
    },
    profilePic: {
        type: String,
        default: 'default-customer.png'
    },
    customerStatus: {
        type: String,
        enum: ['running', 'closed'],
        default: 'running'
    },
    accountStatus: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'creatorModel'
    },
    creatorModel: {
        type: String,
        enum: ['Admin', 'User']
    },
    notes: [{
        content: String,
        addedBy: String,
        createdAt: { type: Date, default: Date.now }
    }]
}, {
    timestamps: true
});

// Encrypt password using bcrypt
customerSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        return;
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

module.exports = mongoose.model('Customer', customerSchema);
