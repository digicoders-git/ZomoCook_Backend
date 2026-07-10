const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const dbUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ZomoCook';
    console.log(`Connecting to database URI: ${dbUri}`);
    const conn = await mongoose.connect(dbUri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
