require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');
const Plan = require('./models/Plan');

const seedPlans = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");

        const plans = [
            {
                name: 'Standard Plan',
                price: 699,
                durationDays: 90,
                jobPostLimit: 5,
                hiringLimit: 2,
                features: ['Contact & Chat with Cook', 'Priority Listing', 'Replacement Support', 'Basic Customer Support'],
                isPopular: true,
                isBestValue: false,
                isActive: true,
                allowedJobCategories: []
            },
            {
                name: 'Premium Plan',
                price: 999,
                durationDays: 180,
                jobPostLimit: 15,
                hiringLimit: 5,
                features: ['Everything in Standard +', 'Priority Assistance', 'Dedicated Support'],
                isPopular: false,
                isBestValue: true,
                isActive: true,
                allowedJobCategories: []
            },
            {
                name: 'Basic Plan',
                price: 399,
                durationDays: 30,
                jobPostLimit: 2,
                hiringLimit: 1,
                features: ['Contact & Chat with Cook'],
                isPopular: false,
                isBestValue: false,
                isActive: true,
                allowedJobCategories: []
            }
        ];

        await Plan.deleteMany();
        await Plan.insertMany(plans);
        console.log("Plans seeded successfully!");
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

seedPlans();
