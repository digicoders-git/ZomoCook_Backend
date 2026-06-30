const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Candidate = require('./models/Candidate');
const Job = require('./models/Job');
const Customer = require('./models/Customer');
const User = require('./models/User');
const Application = require('./models/Application');

dotenv.config();

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB Atlas');

    // 1. Find User John Doe
    const user = await User.findOne({ phone: '7549910025' });
    if (!user) {
      console.error('User John Doe (7549910025) not found. Please log in first in the mobile app.');
      process.exit(1);
    }
    console.log(`Found User: ${user.name} (${user._id})`);

    // Clear existing seeded data for this user
    await Application.deleteMany({ customer: user._id });
    await Job.deleteMany({ createdBy: user._id });
    await Customer.deleteMany({ createdBy: user._id });

    // 2. Create a Customer Profile for John Doe
    const customer = await Customer.create({
      name: 'Johns Gourmet Kitchen',
      email: 'john.kitchen@example.com',
      password: 'password123',
      contactName: 'John Doe',
      contactPhone: '7549910025',
      contactAddress: 'Aliganj, Lucknow',
      propertyCategory: 'hotel',
      createdBy: user._id,
      creatorModel: 'User'
    });
    console.log(`Created Customer Profile: ${customer.name}`);

    // 3. Create a Job
    const job = await Job.create({
      title: 'Italian Head Chef',
      jobCategory: 'hotel',
      overview: 'Looking for an experienced chef who can make premium pasta and pizza.',
      responsibilities: 'Managing kitchen staff, cooking main courses, menu planning.',
      requirements: '3+ years experience in fine dining.',
      customer: customer._id,
      state: 'Uttar Pradesh',
      city: 'Lucknow',
      jobType: 'Full Time',
      jobPosition: 'Head Chef',
      salaryRange: '25,000',
      createdBy: user._id,
      creatorModel: 'User'
    });
    console.log(`Created Job: ${job.title}`);

    // 4. Create Candidates and Applications
    const candidatesData = [
      { name: 'Amit Kumar', phone: '9000000001', email: 'amit@example.com', status: 'Shortlisted' },
      { name: 'Suresh Raina', phone: '9000000002', email: 'suresh@example.com', status: 'Demo Scheduled' },
      { name: 'Virat Kohli', phone: '9000000003', email: 'virat@example.com', status: 'Hired' },
      { name: 'MS Dhoni', phone: '9000000004', email: 'msd@example.com', status: 'Rejected' },
      { name: 'KL Rahul', phone: '9000000005', email: 'kl@example.com', status: 'On Hold' }
    ];

    for (const data of candidatesData) {
      let candidate = await Candidate.findOne({ phone: data.phone });
      if (candidate) {
        await candidate.deleteOne();
      }

      candidate = await Candidate.create({
        name: data.name,
        phone: data.phone,
        email: data.email,
        gender: 'male',
        city: 'Lucknow',
        state: 'Uttar Pradesh',
        profileStatus: 'active',
        createdBy: user._id,
        creatorModel: 'User'
      });

      // Create Application
      await Application.create({
        job: job._id,
        candidate: candidate._id,
        customer: user._id,
        status: data.status,
        appliedDate: new Date()
      });

      // Link to candidate
      candidate.applications = [{
        job: job._id,
        status: data.status,
        appliedDate: new Date()
      }];
      await candidate.save();

      console.log(`Created Candidate & Application: ${candidate.name} -> Status: ${data.status}`);
    }

    console.log('Seeding completed successfully on MongoDB Atlas!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
};

seed();
