const mongoose = require('mongoose');

const querySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a name'],
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    required: [true, 'Please add a phone number'],
    trim: true
  },
  message: {
    type: String,
    required: [true, 'Please add a message'],
    trim: true
  },
  status: {
    type: String,
    enum: ['New', 'Assigned', 'In Progress', 'Waiting for Customer', 'Waiting for Candidate', 'Escalated', 'Resolved', 'Closed'],
    default: 'New'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Query', querySchema);
