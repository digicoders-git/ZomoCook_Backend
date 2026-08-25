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
        expires: 600 // OTP expires in 10 minutes (600 seconds) matching DLT template
    }
});

module.exports = mongoose.model('Otp', otpSchema);
