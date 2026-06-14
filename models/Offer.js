const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  code: { type: String, required: true, uppercase: true, trim: true },
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  discountPercent: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

module.exports = mongoose.model('Offer', offerSchema);
