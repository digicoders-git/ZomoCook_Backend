const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  code: { type: String, required: true, uppercase: true, trim: true, unique: true },
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  offerType: { type: String, enum: ['FLAT', 'PERCENTAGE'], default: 'FLAT' },
  discountValue: { type: Number, required: true, default: 0 },
  maxDiscountValue: { type: Number, default: 0 }, // For percentage discounts (0 = no cap)
  applicableOn: { type: String, enum: ['Service Package', 'Hiring Processing Fee', 'Subscription', 'All'], default: 'All' },
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
