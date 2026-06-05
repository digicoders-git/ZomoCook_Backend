const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        default: 'User'
    },
    email: {
        type: String,
        unique: true,
        sparse: true,
        match: [
            /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
            'Please add a valid email'
        ]
    },
    phone: {
        type: String,
        required: [true, 'Please add a phone number']
    },
    password: {
        type: String,
        minlength: 6,
        select: false
    },
    profilePic: {
        type: String,
        default: 'default-user.png'
    },
    role: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Role'
    },
    jobActions: {
        type: String,
        trim: true
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive', 'Cancelled', 'Expired', 'active', 'inactive'],
        default: 'Active'
    },
    fcmToken: { type: String, default: null }
}, {
    timestamps: true
});

// Encrypt password using bcrypt
userSchema.pre('save', async function () {
    if (!this.isModified('password')) {
        return;
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
