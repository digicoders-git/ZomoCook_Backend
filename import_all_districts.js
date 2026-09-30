const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const Master = require('./models/Master');

// Load extracted json
const jsonPath = path.resolve(__dirname, '../../scratch/india_districts.json');

async function run() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB successfully.');

        const rawData = fs.readFileSync(jsonPath, 'utf8');
        const stateDistricts = JSON.parse(rawData);
        const stateKeys = Object.keys(stateDistricts);
        console.log(`Processing ${stateKeys.length} states/UTs from dataset...`);

        // 1. Fetch all existing states from DB
        const existingStates = await Master.find({ category: 'states' });
        const stateMap = new Map(); // normalizedName -> stateDoc

        for (const s of existingStates) {
            stateMap.set(s.name.trim().toLowerCase(), s);
        }

        // 2. Insert any missing states
        const newStatesToInsert = [];
        for (const stateName of stateKeys) {
            const key = stateName.trim().toLowerCase();
            if (!stateMap.has(key)) {
                newStatesToInsert.push({
                    category: 'states',
                    name: stateName.trim(),
                    status: 'active'
                });
            }
        }

        if (newStatesToInsert.length > 0) {
            console.log(`Inserting ${newStatesToInsert.length} new states...`);
            const inserted = await Master.insertMany(newStatesToInsert);
            for (const s of inserted) {
                stateMap.set(s.name.trim().toLowerCase(), s);
            }
        }

        // 3. Fetch all existing cities from DB
        const existingCities = await Master.find({ category: 'cities' });
        const cityMap = new Map(); // `${stateId}_${cityName.toLowerCase()}` -> cityDoc
        const cityByNameOnly = new Map(); // cityName.toLowerCase() -> cityDoc

        for (const c of existingCities) {
            const cityNameKey = c.name.trim().toLowerCase();
            if (c.parentId) {
                cityMap.set(`${c.parentId.toString()}_${cityNameKey}`, c);
            }
            cityByNameOnly.set(cityNameKey, c);
        }

        // 4. Prepare bulk operations for cities
        const bulkOps = [];
        let newCitiesCount = 0;
        let updatedCitiesCount = 0;

        for (const stateName of stateKeys) {
            const stateDoc = stateMap.get(stateName.trim().toLowerCase());
            if (!stateDoc) continue;

            const districts = stateDistricts[stateName];
            for (const districtName of districts) {
                const trimmedName = districtName.trim();
                const nameKey = trimmedName.toLowerCase();
                const compositeKey = `${stateDoc._id.toString()}_${nameKey}`;

                if (cityMap.has(compositeKey)) {
                    // Already exists with proper parentId
                    continue;
                }

                if (cityByNameOnly.has(nameKey)) {
                    // City exists but might have missing parentId or different state
                    const existingCity = cityByNameOnly.get(nameKey);
                    bulkOps.push({
                        updateOne: {
                            filter: { _id: existingCity._id },
                            update: { $set: { parentId: stateDoc._id, status: 'active', name: trimmedName } }
                        }
                    });
                    updatedCitiesCount++;
                } else {
                    // Brand new city
                    bulkOps.push({
                        insertOne: {
                            document: {
                                category: 'cities',
                                name: trimmedName,
                                parentId: stateDoc._id,
                                status: 'active'
                            }
                        }
                    });
                    newCitiesCount++;
                }
            }
        }

        console.log(`Executing ${bulkOps.length} bulk city operations (${newCitiesCount} new, ${updatedCitiesCount} updates)...`);
        if (bulkOps.length > 0) {
            await Master.bulkWrite(bulkOps, { ordered: false });
        }

        const totalStates = await Master.countDocuments({ category: 'states' });
        const totalCities = await Master.countDocuments({ category: 'cities' });

        console.log('\n================ DATA IMPORT COMPLETE ================');
        console.log(`Total States/UTs in DB: ${totalStates}`);
        console.log(`Total Cities/Districts in DB: ${totalCities}`);
        console.log('======================================================\n');

        process.exit(0);
    } catch (err) {
        console.error('Error during import:', err);
        process.exit(1);
    }
}

run();
