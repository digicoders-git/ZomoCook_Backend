const mongoose = require('mongoose');

const WebSettingSchema = new mongoose.Schema({
  // General Settings
  siteName: { type: String, default: 'ZomoCook' },
  companyEmail: { type: String, default: 'info@zomocook.in' },
  contactNumber: { type: String, default: '+91 8009534847' },
  logo: { type: String },
  favicon: { type: String },

  // Address Settings
  fullAddress: { type: String, default: 'Duplex Technologies, Lucknow, Uttar Pradesh, India' },
  copyrightText: { type: String, default: '© 2026 ZomoCook. All Rights Reserved.' },
  googleMapScript: { type: String },

  // Social Media & Other Settings
  facebookUrl: { type: String },
  instagramUrl: { type: String },
  twitterUrl: { type: String },
  linkedinUrl: { type: String },
  youtubeUrl: { type: String },
  importantInstruction: { type: String },
  rescheduleMessage: { type: String },
  
  // Hiring Processing Fee
  jobPostFee: { type: Number, default: 299 },
  jobPostFeeStatus: { type: Boolean, default: true },
  jobPostFeeDescription: { type: String, default: 'Hiring processing fee is a one-time amount charged from customers while posting a job. This amount is non-refundable.' }
}, { timestamps: true });

module.exports = mongoose.model('WebSetting', WebSettingSchema);
