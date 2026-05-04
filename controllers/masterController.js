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

        const masters = await Master.find(query).populate('parentId', 'name').sort({ createdAt: -1 });
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
