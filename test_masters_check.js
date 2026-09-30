const mongoose = require('mongoose');
require('dotenv').config();
const Master = require('./models/Master');

async function test() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const totalStates = await Master.countDocuments({ category: 'states' });
    const totalCities = await Master.countDocuments({ category: 'cities' });
    console.log(`Total States in DB: ${totalStates}`);
    console.log(`Total Cities in DB: ${totalCities}`);

    const maharashtra = await Master.findOne({ category: 'states', name: 'Maharashtra' });
    if (maharashtra) {
        const mhCities = await Master.find({ category: 'cities', parentId: maharashtra._id }).sort({ name: 1 });
        console.log(`Maharashtra cities (${mhCities.length}):`, mhCities.map(c => c.name));
    }

    const up = await Master.findOne({ category: 'states', name: 'Uttar Pradesh' });
    if (up) {
        const upCities = await Master.find({ category: 'cities', parentId: up._id }).sort({ name: 1 });
        console.log(`Uttar Pradesh cities (${upCities.length}):`, upCities.slice(0, 15).map(c => c.name));
    }

    process.exit(0);
}

test().catch(e => { console.error(e); process.exit(1); });
