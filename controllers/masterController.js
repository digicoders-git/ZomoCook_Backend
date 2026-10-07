const Master = require('../models/Master');

/**
 * @desc    Get masters by category
 * @route   GET /api/masters/:category
 */
exports.getMasters = async (req, res) => {
    try {
        const { category } = req.params;
        const { search, parentId } = req.query;
        let query = { category };

        if (search) query.name = new RegExp(search, 'i');
        if (parentId) query.parentId = parentId;

        let sortOption = (category === 'states' || category === 'cities' || req.query.sort === 'name')
            ? { name: 1 }
            : { createdAt: -1 };

        let masters = await Master.find(query).populate('parentId', 'name').sort(sortOption);

        // Auto-seed default items if database for this category is currently empty and search/parentId filter is not applied
        if (masters.length === 0 && !search && !parentId) {
            if (category === 'job-positions') {
                const defaultPositions = [
                    'Executive Chef', 'Head Chef', 'Multicuisine Chef',
                    'North Indian CDP', 'North Indian DCDP', 'North Indian Commi 1st', 'North Indian Commi 2nd', 'North Indian Commi 3rd',
                    'Chinese CDP', 'Chinese DCDP', 'Chinese Commi 1st', 'Chinese Commi 2nd', 'Chinese Commi 3rd',
                    'Tandoor CDP', 'Tandoor DCDP', 'Tandoor Commi 1st', 'Tandoor Commi 2nd', 'Tandoor Commi 3rd',
                    'Continental CDP', 'Continental DCDP', 'Continental Commi 1st', 'Continental Commi 2nd', 'Continental Commi 3rd',
                    'South Indian CDP', 'South Indian DCDP', 'South Indian Commi 1st', 'South Indian Commi 2nd',
                    'Italian', 'Mexican Chef', 'Momo Maker', 'Dimsum Chef', 'Chaap Chef', 'Mughlai Chef', 'Biryani Chef',
                    'Paratha Chef', 'Chaat Master', 'Rolls Chef', 'Sweets Chef Master', 'Bakery Chef',
                    'Assistant / Helper Cook', 'Male Waiter', 'Female Waiter', 'Receptionist', 'Restaurant Manager',
                    'Housekeeping', 'Male Home Cook: 10Hr', 'Male Home Cook: 24Hr', 'Female Home Cook: 10Hr', 'Female Home Cook: 24Hr'
                ];
                await Master.insertMany(defaultPositions.map(pos => ({ name: pos, category: 'job-positions', status: 'active' })));
                masters = await Master.find(query).populate('parentId', 'name').sort({ createdAt: -1 });
            } else if (category === 'joining-types') {
                const defaultJoiningTypes = [
                    'Immediate (Within 24 - 48 Hours)',
                    'Within 1 Week',
                    'Within 15 Days',
                    'Within 1 Month'
                ];
                await Master.insertMany(defaultJoiningTypes.map(t => ({ name: t, category: 'joining-types', status: 'active' })));
                masters = await Master.find(query).populate('parentId', 'name').sort({ createdAt: -1 });
            } else if (category === 'leaves') {
                const defaultLeaves = [
                    '2 days/month',
                    '4 days/month',
                    '6 days/month',
                    'No leaves required'
                ];
                await Master.insertMany(defaultLeaves.map(l => ({ name: l, category: 'leaves', status: 'active' })));
                masters = await Master.find(query).populate('parentId', 'name').sort({ createdAt: -1 });
            } else if (category === 'cooking-preferences') {
                const defaultCookingPrefs = [
                    'Vegetarian (Veg Only)',
                    'Non-Vegetarian',
                    'Both (Veg & Non-Veg)',
                    'Jain Food',
                    'Eggetarian',
                    'Vegan'
                ];
                await Master.insertMany(defaultCookingPrefs.map(p => ({ name: p, category: 'cooking-preferences', status: 'active' })));
                masters = await Master.find(query).populate('parentId', 'name').sort(sortOption);
            } else if (category === 'family-members') {
                const defaultFamilyMembers = [
                    '1 – 2 Members',
                    '3 – 4 Members',
                    '5 – 6 Members',
                    '7 – 8 Members',
                    '8+ Members'
                ];
            } else if (category === 'job-categories') {
                const defaultJobCategories = [
                    { name: 'Hotel / Restaurant / Commercial', value: 'hotel' },
                    { name: 'Home Cook / Domestic', value: 'home' },
                    { name: 'Daily Basis Staff Booking', value: 'daily' },
                    { name: 'Chef for Party & Events', value: 'party' }
                ];
                await Master.insertMany(defaultJobCategories.map(c => ({ name: c.name, value: c.value, category: 'job-categories', status: 'active' })));
                masters = await Master.find(query).populate('parentId', 'name').sort({ createdAt: -1 });
            } else if (category === 'experiences') {
                const defaultExperiences = [
                    'Fresher',
                    '6 months – 1 year',
                    '1 – 2 years',
                    '2 – 3 years',
                    '3 – 5 years',
                    '5+ years'
                ];
                await Master.insertMany(defaultExperiences.map(e => ({ name: e, category: 'experiences', status: 'active' })));
                masters = await Master.find(query).populate('parentId', 'name').sort({ createdAt: -1 });
            } else if (category === 'salaries') {
                const defaultSalaries = [
                    '₹10,000 – ₹15,000/month',
                    '₹15,000 – ₹25,000/month',
                    '₹25,000 – ₹35,000/month',
                    '₹35,000 – ₹50,000/month',
                    '₹50,000 – ₹75,000/month',
                    '₹75,000+/month'
                ];
                await Master.insertMany(defaultSalaries.map(s => ({ name: s, category: 'salaries', status: 'active' })));
                masters = await Master.find(query).populate('parentId', 'name').sort({ createdAt: -1 });
            } else if (category === 'facilities') {
                const defaultFacilities = [
                    'Food & Accommodation',
                    'Only Food Provided',
                    'Only Accommodation Provided',
                    'No Food / No Accommodation',
                    'Food + Travel Allowance'
                ];
                await Master.insertMany(defaultFacilities.map(f => ({ name: f, category: 'facilities', status: 'active' })));
                masters = await Master.find(query).populate('parentId', 'name').sort({ createdAt: -1 });
            } else if (category === 'shift-types') {
                const defaultShifts = [
                    'Full Time (10-12 hrs)',
                    'Day Shift (8-10 hrs)',
                    'Night Shift (8-10 hrs)',
                    'Split Shift (Morning + Evening)',
                    'Part Time (4-6 hrs)'
                ];
                await Master.insertMany(defaultShifts.map(s => ({ name: s, category: 'shift-types', status: 'active' })));
                masters = await Master.find(query).populate('parentId', 'name').sort({ createdAt: -1 });
            } else if (category === 'cook-preferences') {
                const defaultCookPrefs = [
                    'Basic Cook (Home style Food - Less Experience @14k-18k/Month)',
                    'Standard Cook (Multicuisine - Indian, Chinese, South @18k-25k/Month)',
                    'Premium Chef (Multicuisine Professional >@25k/month)'
                ];
                await Master.insertMany(defaultCookPrefs.map(c => ({ name: c, category: 'cook-preferences', status: 'active' })));
                masters = await Master.find(query).populate('parentId', 'name').sort({ createdAt: -1 });
            } else if (category === 'events') {
                const defaultEvents = [
                    'Birthday Party',
                    'Anniversary',
                    'Wedding',
                    'Engagement',
                    'Corporate Event',
                    'House Party',
                    'Festival',
                    'Other'
                ];
                await Master.insertMany(defaultEvents.map(e => ({ name: e, category: 'events', status: 'active' })));
                masters = await Master.find(query).populate('parentId', 'name').sort({ createdAt: -1 });
            } else if (category === 'meal-types') {
                const defaultMeals = [
                    'Breakfast',
                    'Lunch',
                    'High Tea / Snacks',
                    'Dinner'
                ];
                await Master.insertMany(defaultMeals.map(m => ({ name: m, category: 'meal-types', status: 'active' })));
                masters = await Master.find(query).populate('parentId', 'name').sort({ createdAt: -1 });
            } else if (category === 'cuisines') {
                const defaultCuisines = [
                    'North Indian',
                    'South Indian',
                    'Chinese',
                    'Continental',
                    'Italian',
                    'Mughlai',
                    'Mexican',
                    'Desserts',
                    'Beverages'
                ];
                await Master.insertMany(defaultCuisines.map(c => ({ name: c, category: 'cuisines', status: 'active' })));
                masters = await Master.find(query).populate('parentId', 'name').sort({ createdAt: -1 });
            } else if (category === 'states') {
                const defaultStates = [
                    'Uttar Pradesh', 'Delhi', 'Maharashtra', 'Karnataka', 'Haryana', 
                    'Rajasthan', 'Gujarat', 'Madhya Pradesh', 'Punjab', 'Bihar', 
                    'West Bengal', 'Tamil Nadu', 'Telangana', 'Uttarakhand'
                ];
                await Master.insertMany(defaultStates.map(st => ({ name: st, category: 'states', status: 'active' })));
                masters = await Master.find(query).populate('parentId', 'name').sort({ name: 1 });
            }
        }

        res.status(200).json({ success: true, count: masters.length, masters });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Create master record
 * @route   POST /api/masters/:category
 */
exports.createMaster = async (req, res) => {
    try {
        const { category } = req.params;
        const masterData = { ...req.body, category };
        
        // Handle empty parentId to prevent ObjectId cast error
        if (masterData.parentId === "" || masterData.parentId === "null") {
            delete masterData.parentId;
        }
        
        // Handle image if present (for sliders/videos/cms)
        if (req.file) {
            masterData.image = req.file.path;
        }

        const master = await Master.create(masterData);
        res.status(201).json({ success: true, message: 'Record created successfully', master });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Update master record
 * @route   PUT /api/masters/:id
 */
exports.updateMaster = async (req, res) => {
    try {
        const master = await Master.findById(req.params.id);
        if (!master) return res.status(404).json({ success: false, message: 'Record not found' });

        const updateData = { ...req.body };
        if (updateData.parentId === "" || updateData.parentId === "null") {
            updateData.parentId = null;
        }

        if (req.file) {
            updateData.image = req.file.path;
        }

        const updatedMaster = await Master.findByIdAndUpdate(req.params.id, updateData, { new: true }).populate('parentId', 'name');
        res.status(200).json({ success: true, message: 'Record updated successfully', master: updatedMaster });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Delete master record
 * @route   DELETE /api/masters/:id
 */
exports.deleteMaster = async (req, res) => {
    try {
        const master = await Master.findByIdAndDelete(req.params.id);
        if (!master) return res.status(404).json({ success: false, message: 'Record not found' });
        res.status(200).json({ success: true, message: 'Record deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Bulk delete master records
 * @route   POST /api/masters/bulk-delete
 */
exports.bulkDeleteMasters = async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, message: 'No IDs provided for bulk delete' });
        }
        await Master.deleteMany({ _id: { $in: ids } });
        res.status(200).json({ success: true, message: `${ids.length} records deleted successfully` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
