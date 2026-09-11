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

        let masters = await Master.find(query).populate('parentId', 'name').sort({ createdAt: -1 });

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
            delete updateData.parentId;
            // Also explicitly set to undefined if needed, or use $unset
        }

        if (req.file) {
            updateData.image = req.file.path;
        }

        const updatedMaster = await Master.findByIdAndUpdate(req.params.id, updateData, { new: true });
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
