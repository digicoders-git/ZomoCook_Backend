const mongoose = require('mongoose');

const MONGO_URI_SRV = "mongodb+srv://digicodersdevelopment_db_user:KoJGvdKsGU9IQQvk@cluster0.9ssqshr.mongodb.net/ZomoCook?retryWrites=true&w=majority";

const candidateSchema = new mongoose.Schema({}, { strict: false });
const Candidate = mongoose.model('Candidate', candidateSchema);

async function run() {
  try {
    await mongoose.connect(MONGO_URI_SRV);
    console.log("Connected to Remote Atlas MongoDB successfully!");
    
    const count = await Candidate.countDocuments();
    console.log("Total candidates in remote DB:", count);
    
    const candidates = await Candidate.find().limit(5);
    console.log("Sample candidates in remote DB:");
    candidates.forEach(c => {
      console.log(`- ID: ${c._id}, Name: ${c.name}, Status: ${c.profileStatus || 'none'}, Kyc: ${c.kycStatus || 'none'}, Category: ${c.jobPreference?.jobCategory}`);
    });
    
  } catch (e) {
    console.error("Error:", e);
  } finally {
    await mongoose.disconnect();
  }
}

run();
