const mongoose = require('mongoose');
require('dotenv').config();

const Application = require('./models/Application');
const ServicePackagePayment = require('./models/ServicePackagePayment');
const ServicePackage = require('./models/ServicePackage');

/**
 * Migration script to update existing applications to new workflow
 * 
 * This script:
 * 1. Updates existing 'Demo Scheduled' and 'Hired' applications to 'Package Paid'
 * 2. Creates ServicePackagePayment records for historical data
 * 3. Sets servicePackagePaid = true for applications that should proceed
 */
const migrateApplications = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Get default service package (Standard)
        const defaultPackage = await ServicePackage.findOne({ name: 'Standard' });
        if (!defaultPackage) {
            console.error('Standard service package not found. Run seed_service_packages.js first.');
            process.exit(1);
        }

        // Find all applications that are in Demo Scheduled or Hired status
        const applicationsToMigrate = await Application.find({
            status: { $in: ['Demo Scheduled', 'Hired'] }
        });

        console.log(`Found ${applicationsToMigrate.length} applications to migrate`);

        let migratedCount = 0;
        let errorCount = 0;

        for (const app of applicationsToMigrate) {
            try {
                // Skip if already has payment record
                if (app.servicePackagePaymentId) {
                    console.log(`Skipping ${app._id} - already has payment record`);
                    continue;
                }

                // Create service package payment record
                const payment = await ServicePackagePayment.create({
                    application: app._id,
                    customer: app.customer,
                    packageType: 'Standard',
                    amount: defaultPackage.price,
                    replacementLimit: defaultPackage.replacementLimit,
                    status: 'paid',
                    paidDate: app.updatedAt || new Date()
                });

                // Update application
                app.servicePackage = 'Standard';
                app.servicePackagePaymentId = payment._id;
                app.servicePackagePaid = true;
                app.packageSelectedDate = app.updatedAt || new Date();
                app.packagePaidDate = app.updatedAt || new Date();
                
                // Update status if it's Demo Scheduled, set to Package Paid
                if (app.status === 'Demo Scheduled') {
                    app.status = 'Package Paid';
                }
                
                await app.save();
                migratedCount++;
                console.log(`✓ Migrated application ${app._id}`);
            } catch (error) {
                errorCount++;
                console.error(`✗ Error migrating application ${app._id}:`, error.message);
            }
        }

        console.log(`\nMigration complete:`);
        console.log(`- Successfully migrated: ${migratedCount}`);
        console.log(`- Errors: ${errorCount}`);

        await mongoose.connection.close();
        console.log('Database connection closed');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

// Run migration
migrateApplications();
