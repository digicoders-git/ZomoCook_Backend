const WebSetting = require('../models/WebSetting');

/**
 * @desc    Get all web settings
 * @route   GET /api/settings
 * @access  Private
 */
const getWebSettings = async (req, res) => {
    try {
        let settings = await WebSetting.findOne();
        if (!settings) {
            // Create default settings if none exist
            settings = await WebSetting.create({});
        }
        res.json({ success: true, settings });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Update web settings
 * @route   PUT /api/settings
 * @access  Private
 */
const updateWebSettings = async (req, res) => {
    try {
        let settings = await WebSetting.findOne();
        if (!settings) {
            settings = new WebSetting();
        }

        const {
            siteName, companyEmail, contactNumber,
            fullAddress, copyrightText, googleMapScript,
            facebookUrl, instagramUrl, twitterUrl, linkedinUrl, youtubeUrl,
            importantInstruction, rescheduleMessage,
            jobPostFee, jobPostFeeStatus, jobPostFeeDescription,
            responsibilities
        } = req.body;

        if (siteName !== undefined) settings.siteName = siteName;
        if (companyEmail !== undefined) settings.companyEmail = companyEmail;
        if (contactNumber !== undefined) settings.contactNumber = contactNumber;
        if (fullAddress !== undefined) settings.fullAddress = fullAddress;
        if (copyrightText !== undefined) settings.copyrightText = copyrightText;
        if (googleMapScript !== undefined) settings.googleMapScript = googleMapScript;
        if (facebookUrl !== undefined) settings.facebookUrl = facebookUrl;
        if (instagramUrl !== undefined) settings.instagramUrl = instagramUrl;
        if (twitterUrl !== undefined) settings.twitterUrl = twitterUrl;
        if (linkedinUrl !== undefined) settings.linkedinUrl = linkedinUrl;
        if (youtubeUrl !== undefined) settings.youtubeUrl = youtubeUrl;
        if (importantInstruction !== undefined) settings.importantInstruction = importantInstruction;
        if (rescheduleMessage !== undefined) settings.rescheduleMessage = rescheduleMessage;
        if (jobPostFee !== undefined) settings.jobPostFee = jobPostFee;
        if (jobPostFeeStatus !== undefined) settings.jobPostFeeStatus = jobPostFeeStatus;
        if (jobPostFeeDescription !== undefined) settings.jobPostFeeDescription = jobPostFeeDescription;

        if (responsibilities !== undefined) {
            try {
                if (typeof responsibilities === 'string') {
                    settings.responsibilities = JSON.parse(responsibilities);
                } else {
                    settings.responsibilities = responsibilities;
                }
                settings.markModified('responsibilities');
            } catch (err) {
                console.error("Error parsing responsibilities JSON:", err);
            }
        }

        // Handle file uploads
        if (req.files) {
            if (req.files.logo) {
                settings.logo = req.files.logo[0].path.replace(/\\/g, '/');
            }
            if (req.files.favicon) {
                settings.favicon = req.files.favicon[0].path.replace(/\\/g, '/');
            }
        }

        await settings.save();
        res.json({ success: true, message: 'Settings updated successfully', settings });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getWebSettings,
    updateWebSettings
};
