const mongoose = require('mongoose');
require('dotenv').config();

const ServicePackage = require('./models/ServicePackage');

const seedServicePackages = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Clear existing packages
        await ServicePackage.deleteMany({});

        const packages = [
            {
                name: 'Basic',
                price: 499,
                replacementLimit: 1,
                demoLimit: 1,
                features: [
                    '1 cook profile review',
                    '1 demo/trial',
                    '1 replacement if rejected',
                    'Masked calling'
                ],
                description: 'Perfect for trying out our service',
                isActive: true
            },
            {
                name: 'Standard',
                price: 999,
                replacementLimit: 2,
                demoLimit: 2,
                features: [
                    'Up to 3 cook profiles',
                    '2 demos/trials',
                    '2 replacements if rejected',
                    'Masked calling',
                    'Priority support'
                ],
                description: 'Most popular choice for regular hiring',
                isActive: true
            },
            {
                name: 'Premium',
                price: 1999,
                replacementLimit: 5,
                demoLimit: 5,
                features: [
                    'Unlimited cook profiles',
                    '5 demos/trials',
                    '5 replacements if rejected',
                    'Masked calling',
                    'Priority support',
                    'Direct contact after hire',
                    'Dedicated account manager'
                ],
                description: 'Best for high-volume hiring',
                isActive: true
            }
        ];

        const result = await ServicePackage.insertMany(packages);
        console.log('Service packages seeded successfully:', result);

        await mongoose.connection.close();
        console.log('Database connection closed');
    } catch (error) {
        console.error('Error seeding service packages:', error);
        process.exit(1);
    }
};

seedServicePackages();
