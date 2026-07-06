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

module.exports = {
  getOffers,
  createOffer,
  updateOffer,
  deleteOffer
};
