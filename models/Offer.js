const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  code: { type: String, required: true, uppercase: true, trim: true, unique: true },
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  offerType: { type: String, enum: ['FLAT', 'PERCENTAGE'], default: 'FLAT' },
  discountValue: { type: Number, required: true, default: 0 },
  maxDiscountValue: { type: Number, default: 0 }, // For percentage discounts (0 = no cap)
  targetPlatform: { type: String, enum: ['All', 'Website', 'App'], default: 'All' },
  applicableOn: { 
    type: String, 
    enum: ['All', 'Chef for Party', 'Daily Basis Staff', 'Home Cook Hiring', 'Commercial Hiring', 'Service Package', 'Hiring Processing Fee', 'Subscription'], 
    default: 'All' 
  },
  minOrderValue: { type: Number, default: 0 },
  usageLimitTotal: { type: Number, default: 0 }, // 0 = unlimited
  usageLimitPerUser: { type: Number, default: 1 },
  usedCount: { type: Number, default: 0 },
  salesPersonName: { type: String, default: '' },
  salesPersonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  validFrom: { type: Date },
  validTo: { type: Date },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'SCHEDULED', 'EXPIRED'], default: 'ACTIVE' },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

module.exports = mongoose.model('Offer', offerSchema);
