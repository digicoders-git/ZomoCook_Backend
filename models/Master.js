const mongoose = require('mongoose');

const masterSchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
    index: true
  },
  name: {
    type: String,
    required: [true, 'Please add a name'],
    trim: true
  },
  value: {
    type: String, // For color codes, hex, extra info
    trim: true
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Master',
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  from: Number,
  to: Number,
  experienceFrom: String,
  experienceTo: String,
  salaryFrom: String,
  salaryTo: String,
  timeFrom: String,
  timeTo: String,
  // For CMS/Videos/Sliders
  image: String,
  link: String,
  heading: String,
  content: String
}, {
  timestamps: true
});

module.exports = mongoose.model('Master', masterSchema);
