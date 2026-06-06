const Banner = require('../models/Banner');
const fs = require('fs');

// Helper to delete file if it exists
const deleteFile = (filePath) => {
    if (filePath && fs.existsSync(filePath)) {
        try { 
            fs.unlinkSync(filePath); 
        } catch (e) { 
            console.error('Error deleting banner file:', e); 
        }
    }
};

/**
 * @desc    Create a new banner
 * @route   POST /api/banners
 * @access  Private
 */
const createBanner = async (req, res) => {
    try {
        const { title, link, status } = req.body;
        
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Please upload a banner image' });
        }

        const bannerData = {
            title,
            link,
            status,
            image: req.file.path,
            createdBy: req.admin?._id
        };

        const banner = await Banner.create(bannerData);
        res.status(201).json({ success: true, message: 'Banner created successfully', banner });
    } catch (error) {
        // Cleanup uploaded file if DB creation fails
        if (req.file) deleteFile(req.file.path);
        res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get all banners
 * @route   GET /api/banners
 * @access  Public
 */
const getBanners = async (req, res) => {
    try {
        const { status } = req.query;
        let query = {};
        
        if (status) {
            query.status = status;
        }

        const banners = await Banner.find(query).sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: banners.length, banners });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get a single banner details
 * @route   GET /api/banners/:id
 * @access  Public
 */
const getBanner = async (req, res) => {
    try {
        const banner = await Banner.findById(req.params.id);
        if (!banner) {
            return res.status(404).json({ success: false, message: 'Banner not found' });
        }
        res.status(200).json({ success: true, banner });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Update an existing banner
 * @route   PUT /api/banners/:id
 * @access  Private
 */
const updateBanner = async (req, res) => {
    try {
        const banner = await Banner.findById(req.params.id);
        if (!banner) {
            if (req.file) deleteFile(req.file.path);
            return res.status(404).json({ success: false, message: 'Banner not found' });
        }

        const { title, link, status } = req.body;
        const updateData = { title, link, status };

        if (req.file) {
            // Delete old file
            deleteFile(banner.image);
            // Save new path
            updateData.image = req.file.path;
        }

        const updatedBanner = await Banner.findByIdAndUpdate(req.params.id, updateData, {
            new: true,
            runValidators: true
        });

        res.status(200).json({ success: true, message: 'Banner updated successfully', banner: updatedBanner });
    } catch (error) {
        if (req.file) deleteFile(req.file.path);
        res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Delete a banner
 * @route   DELETE /api/banners/:id
 * @access  Private
 */
const deleteBanner = async (req, res) => {
    try {
        const banner = await Banner.findById(req.params.id);
        if (!banner) {
            return res.status(404).json({ success: false, message: 'Banner not found' });
        }

        // Delete associated image file from disk
        deleteFile(banner.image);

        // Delete from database
        await banner.deleteOne();

        res.status(200).json({ success: true, message: 'Banner deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createBanner,
    getBanners,
    getBanner,
    updateBanner,
    deleteBanner
};
