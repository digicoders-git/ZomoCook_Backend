const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const checkDb = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/zomocook');
        console.log('Connected to DB');

        const Job = require('./models/Job');
        const Application = require('./models/Application');
        const Customer = require('./models/Customer');
        const User = require('./models/User');

        const allCustomers = await Customer.find();
        console.log('\n--- ALL CUSTOMERS ---');
        allCustomers.forEach(c => console.log(`Customer: ${c._id}, Name: ${c.name}, CreatedBy: ${c.createdBy}, CreatorModel: ${c.creatorModel}`));

        const allJobs = await Job.find();
        console.log('\n--- ALL JOBS ---');
        allJobs.forEach(j => console.log(`Job: ${j._id}, Title: ${j.title}, CustomerRef: ${j.customer}, CreatedBy: ${j.createdBy}, CreatorModel: ${j.creatorModel}, Status: ${j.status}`));

        const allApps = await Application.find();
        console.log('\n--- ALL APPLICATIONS ---');
        allApps.forEach(a => console.log(`App: ${a._id}, JobRef: ${a.job}, CustRef: ${a.customer}, Status: ${a.status}`));

        mongoose.connection.close();
    } catch (err) {
        console.error(err);
    }
};

checkDb();
