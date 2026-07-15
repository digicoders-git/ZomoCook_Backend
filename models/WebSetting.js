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
  jobPostFeeDescription: { type: String, default: 'Hiring processing fee is a one-time amount charged from customers while posting a job. This amount is non-refundable.' },

  // Dynamic responsibilities configuration by role/category
  responsibilities: {
    type: mongoose.Schema.Types.Mixed,
    default: {
      chef: {
        displayName: 'Chef / Kitchen Staff',
        willDo: [
          'Meal Preparation as per selected service',
          'Veg & Non-Veg Cooking',
          'Cutting & Prep',
          'Basic Kitchen Cleaning',
          'Kitchen Hygiene',
          'Grocery & Stock Management',
          'Used Utensil wash'
        ],
        willNotDo: [
          'House Cleaning',
          'Bathroom Cleaning',
          'Laundry',
          'Babysitting',
          'Elderly Care'
        ]
      },
      cook: {
        displayName: 'Home Cook / Cook',
        willDo: [
          'Meal Preparation as per selected service',
          'Veg & Non-Veg Cooking',
          'Cutting & Prep',
          'Basic Kitchen Cleaning',
          'Kitchen Hygiene',
          'Grocery & Stock Management',
          'Used Utensil wash'
        ],
        willNotDo: [
          'House Cleaning',
          'Bathroom Cleaning',
          'Laundry',
          'Babysitting',
          'Elderly Care'
        ]
      },
      helper: {
        displayName: 'Kitchen Helper / Assistant',
        willDo: [
          'Vegetable cutting & preparation work',
          'Basic kitchen assistance',
          'Dish washing related to kitchen work',
          'Assisting chefs during cooking',
          'Kitchen cleaning after operations',
          'Loading/unloading kitchen items',
          'Maintaining kitchen hygiene',
          'Supporting daily kitchen operations'
        ],
        willNotDo: [
          'Full house cleaning',
          'Bathroom cleaning',
          'Babysitting or elderly care',
          'Cooking as main chef',
          'Personal household work',
          'Heavy construction/labor work',
          'Outside market/grocery errands'
        ]
      },
      waiter: {
        displayName: 'Waiter / Steward',
        willDo: [
          'Food & beverage serving',
          'Guest table service',
          'Table setup & clearing',
          'Taking customer orders',
          'Basic restaurant cleanliness around service area',
          'Serving water, snacks & meals',
          'Coordination with kitchen staff',
          'Maintaining hygiene & grooming standards'
        ],
        willNotDo: [
          'Deep cleaning / housekeeping work',
          'Bathroom cleaning',
          'Heavy kitchen helper work',
          'Cooking responsibilities',
          'Cash handling (unless assigned)',
          'Loading/unloading heavy materials',
          'Personal household work'
        ]
      },
      dishwasher: {
        displayName: 'Dishwasher / Utility Staff',
        willDo: ['Dishwashing', 'Kitchen Cleaning', 'Garbage Clearance'],
        willNotDo: ['Cooking', 'Table Service / Serving Food', 'Billing / Cash Handling']
      },
      sitter: {
        displayName: 'Baby Sitter / Nanny',
        willDo: ['Babysitting / Child Care', 'Baby Food Prep', 'Baby Clothes Washing'],
        willNotDo: ['Cooking Family Meals', 'House Cleaning / Mopping', 'Washing Family Clothes']
      }
    }
  }
}, { timestamps: true });

module.exports = mongoose.model('WebSetting', WebSettingSchema);
