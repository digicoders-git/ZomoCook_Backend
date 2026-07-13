const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

async function run() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ZomoCook';
    await mongoose.connect(mongoUri);
    
    const User = require('./models/User');
    const Role = require('./models/Role');
    
    // Find roles that are NOT Cook/Customer
    const appRoles = await Role.find({
      name: { $in: [/cook/i, /customer/i, /user/i] }
    });
    const appRoleIds = appRoles.map(r => r._id);
    
    const staffUsers = await User.find({
      role: { $nin: appRoleIds }
    }).populate('role');
    
    console.log(`Found ${staffUsers.length} staff users:`);
    staffUsers.forEach(u => {
      console.log(`- User: ${u.name}, Email: ${u.email}, Phone: ${u.phone}`);
      console.log(`  Role: ${u.role ? u.role.name : 'None'}`);
      if (u.role) {
        console.log(`  Role Permissions (${u.role.permissions?.length || 0}):`, u.role.permissions);
      }
    });
    
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

run();
