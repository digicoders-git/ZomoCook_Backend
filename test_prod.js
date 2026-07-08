const mongoose = require('mongoose');
const User = require('./models/User');
const Role = require('./models/Role');

mongoose.connect('mongodb+srv://digicodersdevelopment_db_user:KoJGvdKsGU9IQQvk@cluster0.9ssqshr.mongodb.net/ZomoCook?retryWrites=true&w=majority')
.then(async () => { 
  const users = await User.find({ name: 'Madan Tiwari' }).populate('role'); 
  for(let user of users) {
    console.log(`User: ${user.name}, Role: ${user.role ? user.role.name : 'No role'}, Perms: ${user.role ? user.role.permissions : 'N/A'}`);
  }
  process.exit(0); 
}).catch(console.error);
