const mongoose = require('mongoose');
require('dotenv').config();
const Master = require('./models/Master');

async function deduplicate() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const allStates = await Master.find({ category: 'states' });
        console.log(`Initial states in DB: ${allStates.length}`);

        const stateGroups = new Map();
        for (const s of allStates) {
            const key = s.name.trim().toLowerCase();
            if (!stateGroups.has(key)) {
                stateGroups.set(key, []);
            }
            stateGroups.get(key).push(s);
        }

        let removedStates = 0;

        for (const [key, list] of stateGroups.entries()) {
            if (list.length > 1) {
                console.log(`Found duplicate state: "${list[0].name}" (${list.length} copies)`);
                // Find which one has the most cities linked to it
                let bestDoc = list[0];
                let maxCities = -1;

                for (const doc of list) {
                    const count = await Master.countDocuments({ category: 'cities', parentId: doc._id });
                    if (count > maxCities) {
                        maxCities = count;
                        bestDoc = doc;
                    }
                }

                console.log(`  -> Keeping ID: ${bestDoc._id} (has ${maxCities} cities)`);

                // Repoint all other copies to bestDoc and delete other copies
                for (const doc of list) {
                    if (doc._id.toString() !== bestDoc._id.toString()) {
                        await Master.updateMany(
                            { category: 'cities', parentId: doc._id },
                            { $set: { parentId: bestDoc._id } }
                        );
                        await Master.findByIdAndDelete(doc._id);
                        removedStates++;
                    }
                }
            }
        }

        // Also ensure all cities match case and parent
        const finalStates = await Master.find({ category: 'states' }).sort({ name: 1 });
        const finalCities = await Master.find({ category: 'cities' });

        console.log('\n================ DEDUPLICATION COMPLETE ================');
        console.log(`States removed: ${removedStates}`);
        console.log(`Unique States remaining: ${finalStates.length}`);
        console.log(`Total Cities in DB: ${finalCities.length}`);
        console.log('========================================================\n');

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

deduplicate();
