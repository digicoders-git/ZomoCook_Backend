const mongoose = require('mongoose');

async function test() {
  try {
    await mongoose.connect('mongodb://localhost:27017/ZomoCook');
    const User = require('./models/User');
    const Role = require('./models/Role');
    
    // Create a mock Manager role if it doesn't exist
    let managerRole = await Role.findOne({ name: 'Manager' });
    if (!managerRole) {
      managerRole = await Role.create({ name: 'Manager' });
    }
    
    // Insert mock user
    const mockUser = await User.create({
      name: 'Test Manager ' + Date.now(),
      email: 'testmanager' + Date.now() + '@example.com',
      phone: '999999999' + Math.floor(Math.random() * 10),
      password: 'password123',
      role: managerRole._id,
      status: 'Active'
    });
    console.log('Created mock user:', mockUser.name, mockUser._id);
    
    // Now run getUsers logic
    let query = {};
    const excludedRoles = await Role.find({ 
        name: { $regex: new RegExp('^(user|cook|customer)$', 'i') } 
    });
    console.log('Excluded roles:', excludedRoles.map(r => r.name));
    
    if (excludedRoles.length > 0) {
        query.role = { $nin: excludedRoles.map(r => r._id) };
    }
    
    const page = 1;
    const limit = 10;
    const startIndex = (page - 1) * limit;

    const total = await User.countDocuments(query);
    const users = await User.find(query).populate('role').sort({ createdAt: -1 }).skip(startIndex).limit(limit);
    
    console.log('Total count:', total);
    console.log('Returned users:', users.length);
    users.forEach(u => console.log(`- ${u.name} (Role: ${u.role ? u.role.name : null})`));
    
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

test();
