const mongoose = require('mongoose');

const mongoUri = 'mongodb+srv://digicodersdevelopment_db_user:KoJGvdKsGU9IQQvk@cluster0.9ssqshr.mongodb.net/ZomoCook?retryWrites=true&w=majority';

const checkLiveUsers = async () => {
    try {
        console.log('Connecting to live MongoDB Atlas database...');
        await mongoose.connect(mongoUri);
        console.log('Connected successfully!');

        // Define a minimal User Schema for querying
        const userSchema = new mongoose.Schema({
            name: String,
            phone: String,
            fcmToken: String,
            role: mongoose.Schema.Types.ObjectId
        }, { collection: 'users' });

        const User = mongoose.models.User || mongoose.model('User', userSchema);

        const users = await User.find({});
        console.log(`Found ${users.length} users in the database:`);
        users.forEach(u => {
            console.log(`ID: ${u._id} | Name: ${u.name} | Phone: ${u.phone} | FCM Token: ${u.fcmToken ? 'Present (' + u.fcmToken.substring(0, 15) + '...)' : 'MISSING'}`);
        });

        mongoose.connection.close();
    } catch (err) {
        console.error('Error connecting or querying live database:', err);
    }
};

checkLiveUsers();
