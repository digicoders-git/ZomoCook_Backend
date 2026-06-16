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
  type: {
    type: String,
    enum: ['job_available', 'application_status', 'demo_scheduled', 'hired', 'booking', 'rating', 'profile', 'offer', 'system'],
    default: 'system'
  },
  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'relatedModel'
  },
  relatedModel: {
    type: String,
    enum: ['Job', 'Application', 'Booking', 'Candidate', 'Customer'],
    default: 'Candidate'
  },
  actionUrl: {
    type: String // e.g., '/jobs/id', '/applications/id', '/bookings/id'
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
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'recipientModel'
  },
  recipientModel: {
    type: String,
    enum: ['User', 'Admin'],
    default: 'User'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Notification', notificationSchema);
