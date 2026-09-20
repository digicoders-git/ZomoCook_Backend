const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a dish name'],
    trim: true
  },
  foodType: {
    type: String,
    enum: ['veg', 'non-veg'],
    default: 'veg',
    required: true
  },
  cuisine: {
    type: String,
    required: [true, 'Please specify cuisine'],
    trim: true
  },
  category: {
    type: String,
    required: [true, 'Please specify meal category'],
    trim: true
  },
  cookingCharge: {
    type: Number,
    default: 0
  },
  image: {
    type: String,
    default: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=200'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  order: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('MenuItem', menuItemSchema);
