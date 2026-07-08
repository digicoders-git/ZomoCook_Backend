const mongoose = require('mongoose');
const Role = require('./models/Role');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://developerdigicoders:p4y3F5GjOat3g6D0@zomocook.dxtis.mongodb.net/zomocook?retryWrites=true&w=majority&appName=zomocook')
.then(async () => { 
  const roles = await Role.find(); 
  roles.forEach(r => console.log(r.name, r.permissions.length));
  process.exit(0); 
});
