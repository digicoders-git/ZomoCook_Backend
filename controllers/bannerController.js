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
        const { title, subtitle, cta, link, status, targetAudience } = req.body;
        
        const bannerData = {
            title,
            subtitle,
            cta,
            link,
            status,
            targetAudience: targetAudience || 'both',
            image: req.file ? req.file.path : '',
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
        const { status, targetAudience } = req.query;
        let query = {};
        
        if (status) query.status = status;
        if (targetAudience && targetAudience !== 'all') {
            query.$or = [{ targetAudience: targetAudience }, { targetAudience: 'both' }];
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

        const title = req.body.title !== undefined ? req.body.title : banner.title;
        const subtitle = req.body.subtitle !== undefined ? req.body.subtitle : banner.subtitle;
        const cta = req.body.cta !== undefined ? req.body.cta : banner.cta;
        const link = req.body.link !== undefined ? req.body.link : banner.link;
        const status = req.body.status !== undefined ? req.body.status : banner.status;
        const targetAudience = req.body.targetAudience !== undefined ? req.body.targetAudience : banner.targetAudience;

        const updateData = { title, subtitle, cta, link, status, targetAudience };

        if (req.file) {
            deleteFile(banner.image);
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
