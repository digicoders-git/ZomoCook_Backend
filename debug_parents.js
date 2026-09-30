const mongoose = require('mongoose');
require('dotenv').config();
const Master = require('./models/Master');

async function debug() {
    await mongoose.connect(process.env.MONGO_URI);
    const upStates = await Master.find({ category: 'states', name: /uttar pradesh/i });
    console.log('UP states found:', upStates.map(s => ({ id: s._id.toString(), name: s.name })));

    const sampleCity = await Master.findOne({ category: 'cities', name: /lucknow/i });
    console.log('Sample city (lucknow):', sampleCity);

    const upStateIds = upStates.map(s => s._id);
    const upCitiesAny = await Master.find({ category: 'cities', parentId: { $in: upStateIds } });
    console.log('UP cities count across all UP states:', upCitiesAny.length);
    console.log('Cities with null parentId:', await Master.countDocuments({ category: 'cities', parentId: null }));

    // Check parentIds of first 5 cities
    const firstCities = await Master.find({ category: 'cities' }).limit(5);
    for (const c of firstCities) {
        const p = await Master.findById(c.parentId);
        console.log(`City: ${c.name} -> Parent: ${p ? p.name + ' (' + p._id + ')' : 'NOT FOUND (' + c.parentId + ')'}`);
    }

    process.exit(0);
}
debug().catch(e => { console.error(e); process.exit(1); });
