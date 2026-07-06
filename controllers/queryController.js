const Query = require('../models/Query');

/**
 * @desc    Get all queries
 * @route   GET /api/queries
 */
exports.getQueries = async (req, res) => {
    try {
        const { search } = req.query;
        let query = {};

        if (search) {
            query.$or = [
                { name: new RegExp(search, 'i') },
                { phone: new RegExp(search, 'i') },
                { email: new RegExp(search, 'i') },
                { message: new RegExp(search, 'i') }
            ];
        }

        const queries = await Query.find(query)
            .populate({
                path: 'assignedTo',
                select: 'name role',
                populate: { path: 'role', select: 'name' }
            })
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: queries.length, queries });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Create new query (Public)
 * @route   POST /api/queries
 */
exports.createQuery = async (req, res) => {
    try {
        const query = await Query.create(req.body);
        res.status(201).json({ success: true, message: 'Inquiry submitted successfully', query });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Delete query
 * @route   DELETE /api/queries/:id
 */
exports.deleteQuery = async (req, res) => {
    try {
        const query = await Query.findByIdAndDelete(req.params.id);
        if (!query) return res.status(404).json({ success: false, message: 'Query not found' });
        res.status(200).json({ success: true, message: 'Query deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Update query status or assigned user
 * @route   PUT /api/queries/:id
 */
exports.updateQuery = async (req, res) => {
    try {
        const query = await Query.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        ).populate({
            path: 'assignedTo',
            select: 'name role',
            populate: { path: 'role', select: 'name' }
        });

        if (!query) return res.status(404).json({ success: false, message: 'Query not found' });
        res.status(200).json({ success: true, message: 'Query updated successfully', query });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
