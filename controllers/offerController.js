const Offer = require('../models/Offer');

const normalizeApplicableCategory = (val) => {
  if (!val) return 'All';
  const s = String(val).trim().toLowerCase();
  if (s === 'all') return 'All';
  if (s.includes('party')) return 'Chef for Party';
  if (s.includes('daily')) return 'Daily Basis Staff';
  if (s.includes('home') || s.includes('domestic')) return 'Home Cook Hiring';
  if (s.includes('commercial') || s.includes('hotel')) return 'Commercial Hiring';
  if (s.includes('service') || s.includes('package') || s.includes('subscript')) return 'Service Package';
  if (s.includes('processing') || s.includes('fee')) return 'Hiring Processing Fee';
  return val;
};

// @desc    Get all offers
// @route   GET /api/offers
// @access  Public
const getOffers = async (req, res) => {
  try {
    const { activeOnly, platform, applicableOn } = req.query;
    let query = {};
    if (activeOnly === 'true') {
      query.isActive = true;
      query.status = { $in: ['ACTIVE', 'active'] };
      const now = new Date();
      query.$and = [
        { $or: [{ validFrom: { $exists: false } }, { validFrom: null }, { validFrom: { $lte: now } }] },
        { $or: [{ validTo: { $exists: false } }, { validTo: null }, { validTo: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } }] }
      ];
    }
    
    // Filter target platform:
    // If explicit platform sent (e.g. 'App' or 'Website'), include 'All' + matching platforms
    if (platform && platform !== 'All') {
      const pRegex = new RegExp(platform, 'i');
      query.targetPlatform = { $in: ['All', 'all', platform, 'App', 'Customer App', 'mobile', pRegex] };
    } else if (activeOnly === 'true' && !platform) {
      // Default fallback for client app requests where platform wasn't sent
      query.targetPlatform = { $in: ['All', 'all', 'App', 'Customer App', 'Website'] };
    }

    if (applicableOn && applicableOn !== 'All') {
      const normalized = normalizeApplicableCategory(applicableOn);
      if (normalized === 'Service Package' || normalized === 'Subscription') {
        query.applicableOn = { $in: ['All', 'Service Package', 'Subscription', applicableOn] };
      } else {
        query.applicableOn = { $in: ['All', normalized, applicableOn] };
      }
    }

    const offers = await Offer.find(query).sort({ createdAt: -1 });
    res.json({ success: true, offers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create an offer
// @route   POST /api/offers
// @access  Private/Admin
const createOffer = async (req, res) => {
  try {
    const { 
      code, title, subtitle, offerType, discountValue, maxDiscountValue, targetPlatform, applicableOn, 
      minOrderValue, usageLimitTotal, usageLimitPerUser, validFrom, validTo, status, isActive 
    } = req.body;
    
    const newOffer = new Offer({
      code: code ? code.toUpperCase().trim() : '',
      title,
      subtitle,
      offerType: offerType || 'FLAT',
      discountValue: Number(discountValue) || 0,
      maxDiscountValue: Number(maxDiscountValue) || 0,
      targetPlatform: targetPlatform || 'All',
      applicableOn: applicableOn || 'All',
      minOrderValue: Number(minOrderValue) || 0,
      usageLimitTotal: Number(usageLimitTotal) || 0,
      usageLimitPerUser: Number(usageLimitPerUser) || 1,
      validFrom,
      validTo,
      status: status || 'ACTIVE',
      isActive: isActive !== undefined ? isActive : true
    });
    await newOffer.save();
    res.status(201).json({ success: true, offer: newOffer });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Update an offer
// @route   PUT /api/offers/:id
// @access  Private/Admin
const updateOffer = async (req, res) => {
  try {
    const updatedOffer = await Offer.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedOffer) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }
    res.json({ success: true, offer: updatedOffer });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Delete an offer
// @route   DELETE /api/offers/:id
// @access  Private/Admin
const deleteOffer = async (req, res) => {
  try {
    const offer = await Offer.findByIdAndDelete(req.params.id);
    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }
    res.json({ success: true, message: 'Offer deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Validate and calculate coupon discount
// @route   POST /api/offers/validate
// @access  Public
const validateOffer = async (req, res) => {
  try {
    const { code, orderAmount, platform, applicableOn } = req.body;
    if (!code || typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({ success: false, valid: false, message: 'Please enter a coupon code' });
    }

    const numericAmount = Math.max(0, Number(orderAmount) || 0);
    const cleanCode = code.toUpperCase().trim();

    // 1. Search in DB (case-insensitive)
    const offer = await Offer.findOne({ 
      code: { $regex: new RegExp(`^${cleanCode}$`, 'i') } 
    });

    if (offer) {
      if (!offer.isActive || String(offer.status).toUpperCase() !== 'ACTIVE') {
        return res.status(400).json({ success: false, valid: false, message: 'This coupon is inactive or disabled' });
      }

      const reqPlatform = platform || 'App';
      if (offer.targetPlatform && offer.targetPlatform !== 'All' && reqPlatform !== 'All' && offer.targetPlatform.toLowerCase() !== reqPlatform.toLowerCase()) {
        return res.status(400).json({
          success: false,
          valid: false,
          message: `This coupon code is valid only on ${offer.targetPlatform}`
        });
      }

      if (offer.applicableOn && offer.applicableOn !== 'All') {
        const normOfferApp = normalizeApplicableCategory(offer.applicableOn);
        const normReqApp = normalizeApplicableCategory(applicableOn);

        const isPackageMatch = 
          (normOfferApp === 'Service Package' || normOfferApp === 'Subscription') &&
          (normReqApp === 'Service Package' || normReqApp === 'Subscription');

        if (normReqApp !== 'All' && normOfferApp.toLowerCase() !== normReqApp.toLowerCase() && !isPackageMatch) {
          return res.status(400).json({
            success: false,
            valid: false,
            message: `This coupon code is valid only for '${offer.applicableOn}'`
          });
        }
      }

      const now = new Date();
      if (offer.validFrom && now < new Date(offer.validFrom)) {
        return res.status(400).json({ success: false, valid: false, message: 'This coupon offer has not started yet' });
      }
      if (offer.validTo) {
        const validToDate = new Date(offer.validTo);
        if (validToDate.getHours() === 0 && validToDate.getMinutes() === 0) {
          validToDate.setHours(23, 59, 59, 999);
        }
        if (now > validToDate) {
          return res.status(400).json({ success: false, valid: false, message: 'This coupon code has expired' });
        }
      }
      if (offer.usageLimitTotal > 0 && (offer.usedCount || 0) >= offer.usageLimitTotal) {
        return res.status(400).json({ success: false, valid: false, message: 'This coupon usage limit has been reached' });
      }
      if (offer.minOrderValue > 0 && numericAmount < offer.minOrderValue) {
        return res.status(400).json({
          success: false,
          valid: false,
          message: `Minimum order value of ₹${offer.minOrderValue} required for coupon '${offer.code}'`
        });
      }

      let discountAmount = 0;
      if (offer.offerType === 'PERCENTAGE') {
        discountAmount = Math.round(numericAmount * (offer.discountValue / 100));
        if (offer.maxDiscountValue && offer.maxDiscountValue > 0) {
          discountAmount = Math.min(discountAmount, offer.maxDiscountValue);
        }
      } else {
        discountAmount = offer.discountValue;
      }
      discountAmount = Math.min(discountAmount, numericAmount);
      const finalAmount = Math.max(0, numericAmount - discountAmount);

      return res.status(200).json({
        success: true,
        valid: true,
        message: `🎉 Coupon '${offer.code}' applied! You saved ₹${discountAmount}`,
        offer: {
          code: offer.code,
          title: offer.title || `${offer.code} Offer`,
          subtitle: offer.subtitle || (offer.offerType === 'PERCENTAGE' ? `${offer.discountValue}% OFF` : `Flat ₹${offer.discountValue} OFF`),
          offerType: offer.offerType,
          discountValue: offer.discountValue,
          maxDiscountValue: offer.maxDiscountValue || 0,
          discountAmount,
          minOrderValue: offer.minOrderValue || 0,
          salesPersonName: offer.salesPersonName || '',
          finalAmount
        }
      });
    }

    return res.status(404).json({ success: false, valid: false, message: `Invalid coupon code '${cleanCode}'` });
  } catch (error) {
    res.status(500).json({ success: false, valid: false, message: error.message });
  }
};

module.exports = {
  getOffers,
  createOffer,
  updateOffer,
  deleteOffer,
  validateOffer
};
