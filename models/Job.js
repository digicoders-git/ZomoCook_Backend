const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  jobCategory: {
    type: String,
    enum: ['hotel', 'home', 'daily', 'party', 'commercial', 'domestic'],
    required: true,
    trim: true
  },
  bookingType: {
    type: String,
    enum: ['regular', 'daily', 'party'],
    default: 'regular'
  },
  hiringPurpose: {
    type: String, // 'commercial' or 'domestic'
    default: ''
  },
  jobCode: {
    type: String,
    unique: true,
    trim: true
  },
  overview: {
    type: String,
    trim: true,
    default: ''
  },
  responsibilities: {
    type: String,
    trim: true,
    default: ''
  },
  requirements: {
    type: String,
    trim: true,
    default: ''
  },
  benefits: {
    type: String,
    trim: true,
    default: ''
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
  address: String,
  email: String,
  outletName: String,
  pricing: mongoose.Schema.Types.Mixed,
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
    enum: ['Urgent', 'New', 'Assigned', 'Active', 'Inactive', 'Cancelled', 'Expired', 'Open', 'In Progress', 'Closed', 'Hold'],
    default: 'New'
  },
  jobType: {
    type: String,
    default: 'Part Time'
  },
  jobPosition: {
    type: String,
    default: 'Staff'
  },
  packageOrGuestOrVacancy: {
    type: String, // Keep for backward compatibility or generic use
  },
  package: String, // Specifically for Daily Pay
  noOfGuests: String, // Specifically for Daily Pay / Home Cook if needed separate
  staffRequirements: [{
    role: String,
    genderPref: String,
    count: Number,
    ratePerDay: Number,
    days: Number,
    startDate: String,
    startTime: String,
    endTime: String
  }],
  commercialStaffList: [{
    serviceCategory: String,
    staffCategory: String,
    salaryRange: String,
    noOfStaff: Number
  }],
  homeCookLevel: String,
  genderPreference: String,
  serviceDuration: String,
  familyMembers: String,
  startDate: String,
  dailyHiringPurpose: String,
  partyRequirement: {
    city: String,
    paymentMethod: String,
    appliedCoupon: String,
    dates: mongoose.Schema.Types.Mixed,
    datesCount: Number,
    pricingBreakdown: mongoose.Schema.Types.Mixed
  },
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
  leadManager: {
    type: String,
    default: ''
  },
  paymentReminderSent15Min: {
    type: Boolean,
    default: false
  },
  paymentReminderSent1Hour: {
    type: Boolean,
    default: false
  },
  paymentReminderSent6Hour: {
    type: Boolean,
    default: false
  },
  paymentReminderSent24Hour: {
    type: Boolean,
    default: false
  },
  lowAppsReminderSent: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'creatorModel'
  },
  creatorModel: {
    type: String,
    enum: ['Admin', 'User', 'Customer'],
    default: 'User'
  },
  paymentStatus: {
    type: String,
    enum: ['free', 'pending', 'paid'],
    default: 'free'
  },
  advanceAmount: { type: Number, default: 0 },
  jobPostFee: { type: Number, default: 0 },
  assignedStaff: [{
    candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate' },
    name: String,
    role: String,
    phone: String,
    experience: String,
    startOtp: String,
    assignedAt: { type: Date, default: Date.now },
    status: { type: String, default: 'Assigned' }
  }],
  source: {
    type: String,
    enum: ['app', 'web', 'admin'],
    default: 'app'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Job', jobSchema);
