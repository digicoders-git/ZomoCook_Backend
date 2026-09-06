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

  // Mobile App Version & Force Update Settings
  appVersion: {
    latestVersion: { type: String, default: '1.0.7' },
    latestBuildNumber: { type: Number, default: 8 },
    minRequiredVersion: { type: String, default: '1.0.7' },
    minRequiredBuildNumber: { type: Number, default: 8 },
    forceUpdate: { type: Boolean, default: true },
    title: { type: String, default: 'New Update Available! 🚀' },
    message: { type: String, default: 'A new version of ZomoCook is available on the Play Store with important improvements and bug fixes. Please update now to continue using the app.' },
    playStoreUrl: { type: String, default: 'https://play.google.com/store/apps/details?id=digi.coders.zomocook' },
    appStoreUrl: { type: String, default: '' },
    releaseNotes: { type: [String], default: ['Bug fixes and performance improvements', 'Enhanced booking and trial experience', 'UI and security updates'] }
  },

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
  },

  // Daily Basis Charges & Staff Category Charges
  dailyCharges: {
    isActive: { type: Boolean, default: true },
    staffCategories: {
      type: [{
        category: { type: String, required: true },
        label: { type: String, required: true },
        rate: { type: Number, required: true },
        description: { type: String, default: '' },
        isActive: { type: Boolean, default: true }
      }],
      default: [
        { category: 'chef', label: 'Chef / Main Cook', rate: 1499, description: 'Experienced commercial/party chef', isActive: true },
        { category: 'cook', label: 'Home Cook', rate: 1199, description: 'Domestic / daily meal cook', isActive: true },
        { category: 'helper', label: 'Kitchen Helper', rate: 699, description: 'Vegetable cutting & kitchen support', isActive: true },
        { category: 'waiter', label: 'Waiter / Steward', rate: 899, description: 'Food serving & guest hospitality', isActive: true },
        { category: 'cleaner', label: 'Cleaner / Housekeeping', rate: 599, description: 'Kitchen and dining cleaning', isActive: true },
        { category: 'manager', label: 'Kitchen Manager / Supervisor', rate: 1699, description: 'Kitchen & banquet event manager', isActive: true },
        { category: 'bartender', label: 'Bartender / Beverage Staff', rate: 1299, description: 'Bar & mocktail/cocktail service', isActive: true }
      ]
    },
    domesticCharges: {
      breakfastRate: { type: Number, default: 399 },
      lunchRate: { type: Number, default: 499 },
      dinnerRate: { type: Number, default: 499 },
      twoMealsRate: { type: Number, default: 899 },
      threeMealsRate: { type: Number, default: 1399 },
      guestRatePerDay: { type: Number, default: 65 }
    },
    advancePercentage: { type: Number, default: 25 },
    platformFeePercentage: { type: Number, default: 10 },
    gstPercentage: { type: Number, default: 18 }
  }
}, { timestamps: true });

module.exports = mongoose.model('WebSetting', WebSettingSchema);
