const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const dbUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ZomoCook';
    console.log(`Connecting to database URI: ${dbUri}`);
    const conn = await mongoose.connect(dbUri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Clean up duplicate non-sparse email indexes so Mongoose can recreate them with sparse: true
    try {
      const db = conn.connection.db;
      
      // Clean up existing null or empty email strings so they don't violate sparse indexes
      try {
        const resCustomers = await db.collection('customers').updateMany(
          { $or: [{ email: null }, { email: "" }] },
          { $unset: { email: "" } }
        );
        console.log(`Cleaned up ${resCustomers.modifiedCount} null/empty emails in customers collection.`);
      } catch (err) {
        console.log('Error cleaning up customer emails:', err.message);
      }

      try {
        const resUsers = await db.collection('users').updateMany(
          { $or: [{ email: null }, { email: "" }] },
          { $unset: { email: "" } }
        );
        console.log(`Cleaned up ${resUsers.modifiedCount} null/empty emails in users collection.`);
      } catch (err) {
        console.log('Error cleaning up user emails:', err.message);
      }

      // Drop index on customers collection
      try {
        await db.collection('customers').dropIndex('email_1');
        console.log('Successfully dropped old email_1 index on customers collection.');
      } catch (err) {
        console.log('customers email_1 index cleanup status:', err.message);
      }

      // Drop index on users collection
      try {
        await db.collection('users').dropIndex('email_1');
        console.log('Successfully dropped old email_1 index on users collection.');
      } catch (err) {
        console.log('users email_1 index cleanup status:', err.message);
      }
    } catch (indexErr) {
      console.error('Error during index cleanup:', indexErr.message);
    }

  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
