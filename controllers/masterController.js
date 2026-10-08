const Master = require('../models/Master');

/**
 * @desc    Get masters by category
 * @route   GET /api/masters/:category
 */
exports.getMasters = async (req, res) => {
    try {
        const { category } = req.params;
        const { search, parentId } = req.query;
        // Support category aliases
        let categoryQuery = category;
        if (category === 'time-ranges' || category === 'shift-types') {
            categoryQuery = { $in: ['time-ranges', 'shift-types'] };
        } else if (category === 'experiences' || category === 'experience-ranges') {
            categoryQuery = { $in: ['experiences', 'experience-ranges'] };
        } else if (category === 'salaries' || category === 'salary-ranges') {
            categoryQuery = { $in: ['salaries', 'salary-ranges'] };
        } else if (category === 'cooking-preferences' || category === 'food-preferences' || category === 'food-types') {
            categoryQuery = { $in: ['cooking-preferences', 'food-preferences', 'food-types'] };
        } else if (category === 'cooking-categories' || category === 'cuisines') {
            categoryQuery = { $in: ['cooking-categories', 'cuisines'] };
        }

        let query = { category: categoryQuery };

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
                    'Housekeeping', 'Home Cook', 'Baby Sitter', 'Maid', 'Driver', 'Caretaker',
                    'Male Home Cook: 10Hr', 'Male Home Cook: 24Hr', 'Female Home Cook: 10Hr', 'Female Home Cook: 24Hr'
                ];
                await Master.insertMany(defaultPositions.map(pos => ({ name: pos, category: 'job-positions', status: 'active' })));
                masters = await Master.find(query).populate('parentId', 'name').sort({ createdAt: -1 });
            } else if (category === 'joining-types') {
                const defaultJoiningTypes = [
                    'Immediate (Within 24 - 48 Hours)',
                    'Within 3 Days',
                    'Within 1 Week',
                    'Within 15 Days',
                    'Within 1 Month'
                ];
                await Master.insertMany(defaultJoiningTypes.map(t => ({ name: t, category: 'joining-types', status: 'active' })));
                masters = await Master.find(query).populate('parentId', 'name').sort({ createdAt: -1 });
            } else if (category === 'leaves') {
                const defaultLeaves = [
                    '1 day/month',
                    '2 days/month',
                    '3 days/month',
                    '4 days/month',
                    '5 days/month',
                    '6 days/month',
                    'No leaves required'
                ];
                await Master.insertMany(defaultLeaves.map(l => ({ name: l, category: 'leaves', status: 'active' })));
                masters = await Master.find(query).populate('parentId', 'name').sort({ createdAt: -1 });
            } else if (category === 'cooking-preferences' || category === 'food-preferences') {
                const defaultCookingPrefs = [
                    'Vegetarian (Veg Only)',
                    'Non-Vegetarian',
                    'Both (Veg & Non-Veg)',
                    'Pure Veg',
                    'Veg + Non Veg',
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
                await Master.insertMany(defaultFamilyMembers.map(f => ({ name: f, category: 'family-members', status: 'active' })));
                masters = await Master.find(query).populate('parentId', 'name').sort({ createdAt: -1 });
            } else if (category === 'gender-preferences') {
                const defaultGenders = ['Anyone', 'Male', 'Female', 'Any Gender'];
                await Master.insertMany(defaultGenders.map(g => ({ name: g, category: 'gender-preferences', status: 'active' })));
                masters = await Master.find(query).populate('parentId', 'name').sort({ createdAt: -1 });
            } else if (category === 'service-durations') {
                const defaultDurations = [
                    '10 Hours – ( Morning to Evening)',
                    '24 Hours – Live-in Cook',
                    '12 Hours (Day)',
                    '12 Hours (Night)',
                    'Part Time (4-6 Hours)'
                ];
                await Master.insertMany(defaultDurations.map(d => ({ name: d, category: 'service-durations', status: 'active' })));
                masters = await Master.find(query).populate('parentId', 'name').sort({ createdAt: -1 });
            } else if (category === 'job-categories') {
                const defaultJobCategories = [
                    { name: 'Chef / Kitchen Staff', value: 'kitchen' },
                    { name: 'Service & Managing Staff', value: 'service' },
                    { name: 'Cleaning and Other Staff', value: 'cleaning' },
                    { name: 'Hotel / Restaurant / Commercial', value: 'hotel' },
                    { name: 'Home Cook / Domestic', value: 'home' },
                    { name: 'Daily Basis Staff Booking', value: 'daily' },
                    { name: 'Chef for Party & Events', value: 'party' }
                ];
                await Master.insertMany(defaultJobCategories.map(c => ({ name: c.name, value: c.value, category: 'job-categories', status: 'active' })));
                masters = await Master.find(query).populate('parentId', 'name').sort({ createdAt: -1 });
            } else if (category === 'experiences' || category === 'experience-ranges') {
                const defaultExperiences = [
                    'Fresher / Entry Level',
                    '0 – 1 Year',
                    '1 – 2 Years',
                    '2 – 5 Years',
                    '5 – 8 Years',
                    '8+ Years'
                ];
                await Master.insertMany(defaultExperiences.map(e => ({ name: e, category: 'experiences', status: 'active' })));
                masters = await Master.find(query).populate('parentId', 'name').sort({ createdAt: -1 });
            } else if (category === 'salaries' || category === 'salary-ranges') {
                const defaultSalaries = [
                    '₹5,000 – ₹8,000/month',
                    '₹8,000 – ₹12,000/month',
                    '₹12,000 – ₹15,000/month',
                    '₹15,000 – ₹20,000/month',
                    '₹20,000 – ₹25,000/month',
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
            } else if (category === 'benefits') {
                const defaultBenefits = [
                    'Food & Accommodation Provided',
                    'Travel Allowance',
                    'Tips & Service Charge',
                    'PF & ESI Provided',
                    'Overtime Pay',
                    'Performance Bonus',
                    'Medical Insurance'
                ];
                await Master.insertMany(defaultBenefits.map(b => ({ name: b, category: 'benefits', status: 'active' })));
                masters = await Master.find(query).populate('parentId', 'name').sort({ createdAt: -1 });
            } else if (category === 'property-categories') {
                const defaultPropCats = [
                    'Restaurant',
                    'Hotel',
                    'Cafe / Coffee Shop',
                    'Resort',
                    'Cloud Kitchen',
                    'Bar & Pub / Lounge',
                    'Bakery & Confectionery',
                    'Catering / Banquet',
                    'Fast Food / QSR',
                    'Dhaba',
                    'Food Truck / Stall',
                    'Office / Corporate Canteen',
                    'Club',
                    'Other'
                ];
                await Master.insertMany(defaultPropCats.map(p => ({ name: p, category: 'property-categories', status: 'active' })));
                masters = await Master.find(query).populate('parentId', 'name').sort({ createdAt: -1 });
            } else if (category === 'shift-types' || category === 'time-ranges') {
                const defaultShifts = [
                    'Full Time (10-12 hrs)',
                    'Full Time (8-9 hrs)',
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
                    'Dinner',
                    'Full Day Party'
                ];
                await Master.insertMany(defaultMeals.map(m => ({ name: m, category: 'meal-types', status: 'active' })));
                masters = await Master.find(query).populate('parentId', 'name').sort({ createdAt: -1 });
            } else if (category === 'cuisines' || category === 'cooking-categories') {
                const defaultCuisines = [
                    'North Indian',
                    'South Indian',
                    'Chinese',
                    'Continental',
                    'Italian',
                    'Mughlai',
                    'Mexican',
                    'Tandoor',
                    'Bakery & Pastry',
                    'Desserts',
                    'Beverages'
                ];
                await Master.insertMany(defaultCuisines.map(c => ({ name: c, category: 'cuisines', status: 'active' })));
                masters = await Master.find(query).populate('parentId', 'name').sort({ createdAt: -1 });
            } else if (category === 'food-types') {
                const defaultFoodTypes = ['Veg', 'Non-Veg', 'Both (Veg & Non-Veg)', 'Egg', 'Vegan', 'Jain'];
                await Master.insertMany(defaultFoodTypes.map(f => ({ name: f, category: 'food-types', status: 'active' })));
                masters = await Master.find(query).populate('parentId', 'name').sort({ createdAt: -1 });
            } else if (category === 'meal-categories' || category === 'menu-categories') {
                const defaultCategories = ['Main Course', 'Starter', 'Snacks', 'Bread', 'Rice', 'Dessert', 'Drinks', 'Breakfast', 'Sides'];
                await Master.insertMany(defaultCategories.map(c => ({ name: c, category, status: 'active' })));
                masters = await Master.find(query).populate('parentId', 'name').sort({ createdAt: -1 });
            } else if (category === 'offer-types') {
                const defaultOfferTypes = ['PERCENTAGE', 'FLAT'];
                await Master.insertMany(defaultOfferTypes.map(o => ({ name: o, category: 'offer-types', status: 'active' })));
                masters = await Master.find(query).populate('parentId', 'name').sort({ createdAt: -1 });
            } else if (category === 'applicable-types') {
                const defaultApplicables = ['All', 'Service Package', 'Hiring Processing Fee', 'Chef for Party', 'Daily Staff'];
                await Master.insertMany(defaultApplicables.map(a => ({ name: a, category: 'applicable-types', status: 'active' })));
                masters = await Master.find(query).populate('parentId', 'name').sort({ createdAt: -1 });
            } else if (category === 'kyc-statuses') {
                const defaultKyc = ['Pending', 'Approved', 'Rejected'];
                await Master.insertMany(defaultKyc.map(k => ({ name: k, category: 'kyc-statuses', status: 'active' })));
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
