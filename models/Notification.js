const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please add a notification title'],
    trim: true
  },
  message: {
    type: String,
    required: [true, 'Please add a notification message'],
    trim: true
  },
  image: {
    type: String // Path to uploaded image
  },
  target: {
    type: String,
    enum: ['all', 'candidates', 'customers'],
    default: 'all'
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Notification', notificationSchema);
