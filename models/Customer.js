const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const customerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a customer name']
    },
    propertyCategory: {
        type: String,
        required: [true, 'Please select a property category']
    },
    email: {
        type: String,
        required: [true, 'Please add an email'],
        unique: true
    },
    password: {
        type: String,
        required: [true, 'Please add a password'],
        select: false
    },
    contactName: {
        type: String,
        required: [true, 'Please add a contact name']
    },
    contactPhone: {
        type: String,
        required: [true, 'Please add a contact phone number']
    },
    contactAddress: {
        type: String,
        required: [true, 'Please add a contact address']
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
        required: true,
        enum: ['Admin', 'User']
    }
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
