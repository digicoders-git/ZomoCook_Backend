const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
    phone: {
        type: String,
        required: [true, 'Please add a phone number'],
        trim: true
    },
    otp: {
        type: String,
        required: [true, 'Please add an OTP']
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 300 // OTP expires in 5 minutes (300 seconds)
    }
});

module.exports = mongoose.model('Otp', otpSchema);
