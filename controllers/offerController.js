const Offer = require('../models/Offer');

// @desc    Get all offers
// @route   GET /api/offers
// @access  Public
const getOffers = async (req, res) => {
  try {
    const { activeOnly } = req.query;
    let query = {};
    if (activeOnly === 'true') {
      query.isActive = true;
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
      code, title, subtitle, offerType, discountValue, applicableOn, 
      minOrderValue, usageLimitTotal, usageLimitPerUser, validFrom, validTo, status, isActive 
    } = req.body;
    
    const newOffer = new Offer({
      code,
      title,
      subtitle,
      offerType,
      discountValue,
      applicableOn,
      minOrderValue,
      usageLimitTotal,
      usageLimitPerUser,
      validFrom,
      validTo,
      status,
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
    const { code, orderAmount, applicableOn } = req.body;
    if (!code || typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({ success: false, valid: false, message: 'Please enter a coupon code' });
    }

    const numericAmount = Math.max(0, Number(orderAmount) || 0);
    const cleanCode = code.toUpperCase().trim();

    // 1. Search in DB
    const offer = await Offer.findOne({ code: cleanCode });

    if (offer) {
      if (!offer.isActive || offer.status !== 'ACTIVE') {
        return res.status(400).json({ success: false, valid: false, message: 'This coupon is inactive or disabled' });
      }

      const now = new Date();
      if (offer.validFrom && now < new Date(offer.validFrom)) {
        return res.status(400).json({ success: false, valid: false, message: 'This coupon offer has not started yet' });
      }
      if (offer.validTo && now > new Date(offer.validTo)) {
        return res.status(400).json({ success: false, valid: false, message: 'This coupon code has expired' });
      }
      if (offer.usageLimitTotal > 0 && (offer.usedCount || 0) >= offer.usageLimitTotal) {
        return res.status(400).json({ success: false, valid: false, message: 'This coupon usage limit has been reached' });
      }
      if (offer.minOrderValue > 0 && numericAmount < offer.minOrderValue) {
        return res.status(400).json({
          success: false,
          valid: false,
          message: `Minimum order value of ₹${offer.minOrderValue} required for coupon '${cleanCode}'`
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
          subtitle: offer.subtitle || `${offer.offerType === 'PERCENTAGE' ? `${offer.discountValue}% OFF` : `₹${offer.discountValue} Flat OFF`}`,
          offerType: offer.offerType,
          discountValue: offer.discountValue,
          discountAmount,
          minOrderValue: offer.minOrderValue,
          finalAmount
        }
      });
    }

    // 2. Fallback check for standard preset coupons
    if (cleanCode === 'FIRST100') {
      if (numericAmount < 999) {
        return res.status(400).json({ success: false, valid: false, message: 'Minimum booking of ₹999 required for FIRST100' });
      }
      return res.status(200).json({
        success: true,
        valid: true,
        message: '🎉 Coupon FIRST100 applied! You saved ₹100',
        offer: { code: 'FIRST100', title: 'First Booking Offer', subtitle: 'Flat ₹100 OFF', offerType: 'FLAT', discountValue: 100, discountAmount: 100, minOrderValue: 999, finalAmount: numericAmount - 100 }
      });
    }

    if (cleanCode === 'SAVE250') {
      if (numericAmount < 1999) {
        return res.status(400).json({ success: false, valid: false, message: 'Minimum booking of ₹1999 required for SAVE250' });
      }
      return res.status(200).json({
        success: true,
        valid: true,
        message: '🎉 Coupon SAVE250 applied! You saved ₹250',
        offer: { code: 'SAVE250', title: 'Mega Saver Offer', subtitle: 'Flat ₹250 OFF', offerType: 'FLAT', discountValue: 250, discountAmount: 250, minOrderValue: 1999, finalAmount: numericAmount - 250 }
      });
    }

    if (cleanCode === 'ZOMO2000') {
      const disc = Math.min(2000, numericAmount);
      return res.status(200).json({
        success: true,
        valid: true,
        message: '🎉 Coupon ZOMO2000 applied! You saved ₹2,000',
        offer: {
          code: 'ZOMO2000',
          title: 'Special Leads Manager Offer',
          subtitle: '₹2,000 off on Premium Package',
          offerType: 'FLAT',
          discountValue: 2000,
          discountAmount: disc,
          minOrderValue: 0,
          salesPersonName: 'Leads Manager',
          finalAmount: numericAmount - disc
        }
      });
    }

    if (cleanCode === 'SAVE500') {
      if (numericAmount < 4999) {
        return res.status(400).json({ success: false, valid: false, message: 'Minimum booking of ₹4999 required for SAVE500' });
      }
      return res.status(200).json({
        success: true,
        valid: true,
        message: '🎉 Coupon SAVE500 applied! You saved ₹500',
        offer: { code: 'SAVE500', title: 'Premium Saver Offer', subtitle: 'Flat ₹500 OFF', offerType: 'FLAT', discountValue: 500, discountAmount: 500, minOrderValue: 4999, finalAmount: numericAmount - 500 }
      });
    }

    if (cleanCode === 'ZOMO10') {
      let discount = Math.round(numericAmount * 0.10);
      if (discount > 1000) discount = 1000;
      return res.status(200).json({
        success: true,
        valid: true,
        message: `🎉 Coupon ZOMO10 applied! You saved ₹${discount}`,
        offer: { code: 'ZOMO10', title: '10% Discount Offer', subtitle: '10% OFF (Up to ₹1000)', offerType: 'PERCENTAGE', discountValue: 10, discountAmount: discount, minOrderValue: 0, finalAmount: numericAmount - discount }
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
