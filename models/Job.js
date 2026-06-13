const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  jobCategory: {
    type: String,
    enum: ['hotel', 'home', 'daily'],
    required: true,
    trim: true
  },
  jobCode: {
    type: String,
    unique: true,
    trim: true
  },
  overview: {
    type: String,
    required: [true, 'Job overview is required'],
    trim: true
  },
  responsibilities: {
    type: String,
    required: [true, 'Key responsibilities are required'],
    trim: true
  },
  requirements: {
    type: String,
    required: [true, 'Requirements are required'],
    trim: true
  },
  benefits: {
    type: String,
    trim: true
  },
  title: {
    type: String,
    required: [true, 'Job title is required'],
    trim: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  propertyCategory: String,
  state: {
    type: String,
    required: true
  },
  city: {
    type: String,
    required: true
  },
  latitude: Number,
  longitude: Number,
  event: String, // For daily pay jobs
  foodPreference: String, // For home/daily
  mealPreference: String, // For daily
  servingTime: String, // For daily
  basicFacility: String, // For hotel/home
  otherFacilities: String,
  cookingCategory: String, // For home
  menuDetails: String, // For daily
  image: String,
  status: {
    type: String,
    enum: ['Urgent', 'New', 'Active', 'Inactive', 'Cancelled', 'Expired'],
    default: 'New'
  },
  jobType: {
    type: String,
    required: true // Full Time, Part Time
  },
  jobPosition: {
    type: String,
    required: true
  },
  packageOrGuestOrVacancy: {
    type: String, // Keep for backward compatibility or generic use
  },
  package: String, // Specifically for Daily Pay
  noOfGuests: String, // Specifically for Daily Pay / Home Cook if needed separate
  allowedLeave: String,
  salaryRange: String,
  experienceRange: String,
  joiningType: String,
  travelCharges: String,
  dateOfEvent: Date, // For daily pay jobs
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'creatorModel'
  },
  creatorModel: {
    type: String,
    enum: ['Admin', 'User']
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Job', jobSchema);
