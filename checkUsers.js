const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const checkUsers = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/zomocook');
        const User = require('./models/User');
        const allUsers = await User.find();
        console.log('\n--- ALL USERS ---');
        allUsers.forEach(u => console.log(`User: ${u._id}, Name: ${u.name}, Phone: ${u.phone}, RoleRef: ${u.role}`));
        mongoose.connection.close();
    } catch (err) {
        console.error(err);
    }
};

checkUsers();
