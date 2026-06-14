const mongoose = require('mongoose');

// The SRV DNS issue might happen, so using the direct shard connection string
const MONGO_URI = "mongodb://digicodersdevelopment_db_user:KoJGvdKsGU9IQQvk@ac-ofj8h15-shard-00-00.9ssqshr.mongodb.net:27017,ac-ofj8h15-shard-00-01.9ssqshr.mongodb.net:27017,ac-ofj8h15-shard-00-02.9ssqshr.mongodb.net:27017/ZomoCook?ssl=true&replicaSet=atlas-13w148-shard-0&authSource=admin&retryWrites=true&w=majority";

// Fallback to SRV if the above is wrong shard
const MONGO_URI_SRV = "mongodb+srv://digicodersdevelopment_db_user:KoJGvdKsGU9IQQvk@cluster0.9ssqshr.mongodb.net/ZomoCook?retryWrites=true&w=majority";

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");

    const JobSchema = new mongoose.Schema({
        jobCategory: String,
        jobCode: String,
        overview: String,
        responsibilities: String,
        requirements: String,
        benefits: String,
        title: String,
        customer: mongoose.Schema.Types.ObjectId,
        propertyCategory: String,
        state: String,
        city: String,
        status: String,
        jobType: String,
        jobPosition: String,
        packageOrGuestOrVacancy: String,
        allowedLeave: String,
        salaryRange: String,
        location: String,
        latitude: Number,
        longitude: Number,
        outletName: String,
    }, { timestamps: true });

    // Use existing model if exists, otherwise create it
    const Job = mongoose.models.Job || mongoose.model('Job', JobSchema);

    const newJob = new Job({
      jobCategory: "restaurant",
      jobCode: "ZOMO-TEST-NEARBY",
      overview: "We need an experienced cook.",
      responsibilities: "Cooking local dishes.",
      requirements: "1 year experience.",
      benefits: "Accommodation and meals.",
      title: "Nearby Cook - Aliganj",
      state: "UP",
      city: "Lucknow",
      status: "New",
      jobType: "Full Time",
      salaryRange: "15k - 20k",
      location: "Ram Ram Bank Chauraha, Aliganj, Lucknow",
      latitude: 26.8860,
      longitude: 80.9425,
      outletName: "Aliganj Dhaba"
    });

    await newJob.save();
    console.log("Successfully inserted nearby job:", newJob._id);

  } catch (err) {
    console.error("Error connecting with direct string, trying SRV...", err.message);
    try {
        await mongoose.disconnect();
        await mongoose.connect(MONGO_URI_SRV);
        console.log("Connected to MongoDB via SRV");
        const Job = mongoose.models.Job || mongoose.model('Job', new mongoose.Schema({}, {strict: false}));
        const newJob = new Job({
          jobCategory: "restaurant",
          jobCode: "ZOMO-TEST-NEARBY",
          overview: "We need an experienced cook.",
          responsibilities: "Cooking local dishes.",
          requirements: "1 year experience.",
          benefits: "Accommodation and meals.",
          title: "Nearby Cook - Aliganj",
          state: "UP",
          city: "Lucknow",
          status: "New",
          jobType: "Full Time",
          salaryRange: "15k - 20k",
          location: "Ram Ram Bank Chauraha, Aliganj, Lucknow",
          latitude: 26.8860,
          longitude: 80.9425,
          outletName: "Aliganj Dhaba"
        });
        await newJob.save();
        console.log("Successfully inserted nearby job:", newJob._id);
    } catch(err2) {
        console.error("Failed completely", err2.message);
    }
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
