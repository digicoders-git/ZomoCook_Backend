const mongoose = require('mongoose');

const check = async () => {
    try {
        await mongoose.connect('mongodb+srv://developerdigicoders:p4y3F5GjOat3g6D0@zomocook.dxtis.mongodb.net/zomocook?retryWrites=true&w=majority&appName=zomocook');
        console.log('Connected to DB:', mongoose.connection.name);

        const Admin = require('./models/Admin');
        const User = require('./models/User');
        const Role = require('./models/Role');

        const leadManagerRoles = await Role.find({ name: /lead manager/i });
        const lmRoleIds = leadManagerRoles.map(r => r._id);
        console.log('Lead Manager Role IDs:', lmRoleIds);

        const admins = await Admin.find({ role: { $in: lmRoleIds } }).populate('role');
        console.log('\n--- LEAD MANAGERS IN ADMIN COLLECTION ---');
        admins.forEach(a => {
            console.log(`Admin: ${a._id}, Name: "${a.name}", Email: "${a.email}", Role: "${a.role ? a.role.name : 'None'}"`);
        });

        const users = await User.find({ role: { $in: lmRoleIds } }).populate('role');
        console.log('\n--- LEAD MANAGERS IN USER COLLECTION ---');
        users.forEach(u => {
            console.log(`User: ${u._id}, Name: "${u.name}", Email: "${u.email}", Role: "${u.role ? u.role.name : 'None'}"`);
        });

        mongoose.connection.close();
    } catch (e) {
        console.error(e);
    }
};

check();
