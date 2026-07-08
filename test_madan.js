const mongoose = require('mongoose');
const User = require('./models/User');
const Role = require('./models/Role');

mongoose.connect('mongodb://localhost:27017/ZomoCook')
.then(async () => { 
  const users = await User.find().populate('role'); 
  for(let user of users) {
    console.log(`User: ${user.name}, Role: ${user.role ? user.role.name : 'No role'}, Perms: ${user.role ? user.role.permissions : 'N/A'}`);
  }
  process.exit(0); 
});
