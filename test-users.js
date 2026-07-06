const mongoose = require('mongoose');

async function test() {
  try {
    await mongoose.connect('mongodb://localhost:27017/ZomoCook');
    const User = require('./models/User');
    const Role = require('./models/Role');
    
    const users = await User.find().populate('role').sort({ createdAt: -1 }).limit(10);
    console.log(`Found ${users.length} users.`);
    users.forEach(u => {
      console.log(`- ${u.name} | Role: ${u.role ? u.role.name : 'NONE'} | Created: ${u.createdAt}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

test();
