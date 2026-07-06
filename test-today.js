const mongoose = require('mongoose');

async function test() {
  try {
    await mongoose.connect('mongodb://localhost:27017/ZomoCook');
    const User = require('./models/User');
    require('./models/Role');
    require('./models/Plan');
    
    const d = new Date();
    d.setHours(0,0,0,0);
    const users = await User.find({ createdAt: { $gte: d } }).populate('role');
    console.log('Users created today:', users.length);
    users.forEach(u => console.log(u.name, u.email, u.phone, u.role ? u.role.name : null));
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

test();
