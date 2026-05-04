const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Candidate = require('./models/Candidate');
const Job = require('./models/Job');
const Customer = require('./models/Customer');

dotenv.config();

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // 1. Create a Customer if not exists
    let customer = await Customer.findOne({ email: 'client@seed.com' });
    if (!customer) {
      customer = await Customer.create({
        name: 'Seed Hotel Group',
        email: 'client@seed.com',
        password: 'password123',
        contactName: 'Seed Admin',
        contactPhone: '1234567890',
        contactAddress: 'Seed City',
        propertyCategory: 'Hotel'
      });
    }

    // 2. Create a Job
    const job = await Job.create({
      title: 'Senior Executive Chef',
      jobCategory: 'hotel',
      overview: 'Seed job for testing',
      responsibilities: 'Cooking',
      requirements: 'Skills',
      customer: customer._id,
      state: 'Uttar Pradesh',
      city: 'Lucknow',
      jobType: 'Full Time',
      jobPosition: 'Head Chef',
      salaryRange: '50000-80000'
    });

    // 3. Create Candidates with different application statuses
    const statuses = ['Applied', 'Shortlisted', 'Demo Scheduled', 'Hired', 'Rejected', 'On Hold', 'Not Interested'];
    
    const candidatesData = [
      { name: 'Amit Kumar', phone: '9000000001', email: 'amit@seed.com', status: 'Applied' },
      { name: 'Suresh Raina', phone: '9000000002', email: 'suresh@seed.com', status: 'Shortlisted' },
      { name: 'Virat Kohli', phone: '9000000003', email: 'virat@seed.com', status: 'Demo Scheduled' },
      { name: 'MS Dhoni', phone: '9000000004', email: 'msd@seed.com', status: 'Hired' },
      { name: 'Rohit Sharma', phone: '9000000005', email: 'rohit@seed.com', status: 'Rejected' },
      { name: 'KL Rahul', phone: '9000000006', email: 'kl@seed.com', status: 'On Hold' },
      { name: 'Hardik Pandya', phone: '9000000007', email: 'hardik@seed.com', status: 'Not Interested' }
    ];

    for (const data of candidatesData) {
      await Candidate.create({
        name: data.name,
        phone: data.phone,
        email: data.email,
        gender: 'male',
        city: 'Lucknow',
        state: 'Uttar Pradesh',
        profileStatus: 'active',
        applications: [{
          job: job._id,
          status: data.status,
          appliedDate: new Date()
        }]
      });
    }

    console.log('Seeding completed successfully!');
    process.exit();
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
};

seed();
