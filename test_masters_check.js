const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://digicodersdevelopment_db_user:KoJGvdKsGU9IQQvk@ac-ofj8h15-shard-00-00.9ssqshr.mongodb.net:27017,ac-ofj8h15-shard-00-01.9ssqshr.mongodb.net:27017,ac-ofj8h15-shard-00-02.9ssqshr.mongodb.net:27017/ZomoCook?ssl=true&replicaSet=atlas-13w148-shard-0&authSource=admin&retryWrites=true&w=majority";

const Master = require('./models/Master');

async function checkMasters() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const categories = [
      'job-categories',
      'job-positions',
      'states',
      'cities',
      'kyc-statuses',
      'cuisines',
      'food-types',
      'meal-categories',
      'offer-types',
      'applicable-types'
    ];

    for (const cat of categories) {
      let count = await Master.countDocuments({ category: cat });
      if (count === 0) {
        if (cat === 'kyc-statuses') {
          await Master.insertMany(['Pending', 'Approved', 'Rejected'].map(name => ({ name, category: cat, status: 'active' })));
        } else if (cat === 'food-types') {
          await Master.insertMany(['Veg', 'Non-Veg', 'Both (Veg & Non-Veg)', 'Egg', 'Vegan', 'Jain'].map(name => ({ name, category: cat, status: 'active' })));
        } else if (cat === 'meal-categories') {
          await Master.insertMany(['Main Course', 'Starter', 'Snacks', 'Bread', 'Rice', 'Dessert', 'Drinks', 'Breakfast', 'Sides'].map(name => ({ name, category: cat, status: 'active' })));
        } else if (cat === 'offer-types') {
          await Master.insertMany(['PERCENTAGE', 'FLAT'].map(name => ({ name, category: cat, status: 'active' })));
        } else if (cat === 'applicable-types') {
          await Master.insertMany(['All', 'Service Package', 'Hiring Processing Fee', 'Chef for Party', 'Daily Staff'].map(name => ({ name, category: cat, status: 'active' })));
        } else if (cat === 'cuisines') {
          await Master.insertMany(['North Indian', 'South Indian', 'Chinese', 'Continental', 'Italian', 'Mughlai', 'Mexican', 'Desserts', 'Beverages'].map(name => ({ name, category: cat, status: 'active' })));
        }
        count = await Master.countDocuments({ category: cat });
      }
      const sample = await Master.find({ category: cat }).limit(3);
      console.log(`📌 Master [${cat}]: ${count} records (Sample: ${sample.map(s => s.name).join(', ')})`);
    }

    console.log('\n🎉 ALL MASTER DATA CATEGORIES VERIFIED & READY FOR ADMIN PANEL DROPDOWNS!');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkMasters();
