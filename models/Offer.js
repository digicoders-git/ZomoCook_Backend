const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  code: { type: String, required: true, uppercase: true, trim: true },
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  offerType: { type: String, enum: ['FLAT', 'PERCENTAGE'], default: 'FLAT' },
  discountValue: { type: Number, default: 0 },
  applicableOn: { type: String, enum: ['Service Package', 'Hiring Processing Fee', 'All'], default: 'All' },
  minOrderValue: { type: Number, default: 0 },
  usageLimitTotal: { type: Number, default: 0 },
  usageLimitPerUser: { type: Number, default: 1 },
  validFrom: { type: Date },
  validTo: { type: Date },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'SCHEDULED', 'EXPIRED'], default: 'ACTIVE' },
  isActive: { type: Boolean, default: true } // Keep for backward compatibility or simple toggles
}, {
  timestamps: true
});

module.exports = mongoose.model('Offer', offerSchema);
