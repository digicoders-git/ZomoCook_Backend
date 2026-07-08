const Replacement = require('../models/Replacement');
const User = require('../models/User');
const Job = require('../models/Job');
const Candidate = require('../models/Candidate');
const Application = require('../models/Application');

// @desc    Create a new replacement request
// @route   POST /api/replacements
// @access  Private (Customer/User)
exports.createReplacement = async (req, res) => {
    try {
        const { staffName, reason, details } = req.body;
        
        // Find user to get category
        const user = await User.findById(req.admin._id);
        const category = user && user.propertyCategory && user.propertyCategory.toLowerCase().includes('hotel') ? 'Commercial' : 'Domestic';

        // Attempt to find the relevant job this replacement is for
        // First try to find a job where this staffName was hired
        let linkedJobId = null;
        const hiredApp = await Application.findOne({
            customer: req.admin._id,
            status: 'Hired'
        }).populate({
            path: 'candidate',
            match: { name: staffName }
        }).sort('-updatedAt');

        if (hiredApp && hiredApp.candidate) {
            linkedJobId = hiredApp.job;
        } else {
            // Fallback: get the customer's most recent job
            const recentJob = await Job.findOne({ customer: req.admin._id }).sort('-createdAt');
            if (recentJob) {
                linkedJobId = recentJob._id;
            }
        }

        const replacement = await Replacement.create({
            customer: req.admin._id,
            category,
            staffName,
            reason,
            details,
            status: 'Pending',
            job: linkedJobId
        });

        res.status(201).json({
            success: true,
            data: replacement,
            message: 'Replacement request submitted successfully.'
        });
    } catch (error) {
        console.error('Error creating replacement:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Get all replacements
// @route   GET /api/replacements
// @access  Private (Admin)
exports.getReplacements = async (req, res) => {
    try {
        let query = {};
        const isSuperAdmin = req.admin.constructor.modelName === 'Admin';
        if (!isSuperAdmin) {
            query.assignTo = req.admin._id;
        }

        const replacements = await Replacement.find(query)
            .populate({
                path: 'customer',
                select: 'name phone address propertyCategory activePlan',
                populate: {
                    path: 'activePlan',
                    select: 'name duration'
                }
            })
            .populate('assignTo', 'name')
            .populate('job', 'title jobCategory state city')
            .populate('newJob', 'title')
            .populate('assignedCandidate', 'name phone')
            .sort('-createdAt');

        res.status(200).json({
            success: true,
            data: replacements
        });
    } catch (error) {
        console.error('Error fetching replacements:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Get logged in user's replacements
// @route   GET /api/replacements/my-replacements
// @access  Private (User)
exports.getMyReplacements = async (req, res) => {
    try {
        const replacements = await Replacement.find({ customer: req.admin._id })
            .populate('assignedCandidate', 'name phone profileImage')
            .populate('job', 'title')
            .populate('newJob', 'title')
            .sort('-createdAt');

        res.status(200).json({
            success: true,
            data: replacements
        });
    } catch (error) {
        console.error('Error fetching my replacements:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Update a replacement status or assign to
// @route   PUT /api/replacements/:id
// @access  Private (Admin)
exports.updateReplacement = async (req, res) => {
    try {
        const { status, assignTo } = req.body;
        
        const replacement = await Replacement.findById(req.params.id);
        
        if (!replacement) {
            return res.status(404).json({ success: false, message: 'Replacement request not found' });
        }
        
        if (status) replacement.status = status;
        if (assignTo) replacement.assignTo = assignTo;
        
        await replacement.save();
        
        res.status(200).json({
            success: true,
            data: replacement,
            message: 'Replacement request updated successfully.'
        });
    } catch (error) {
        console.error('Error updating replacement:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Delete a replacement
// @route   DELETE /api/replacements/:id
// @access  Private (Admin)
exports.deleteReplacement = async (req, res) => {
    try {
        const replacement = await Replacement.findById(req.params.id);
        
        if (!replacement) {
            return res.status(404).json({ success: false, message: 'Replacement request not found' });
        }
        
        await replacement.deleteOne();
        
        res.status(200).json({
            success: true,
            message: 'Replacement request deleted successfully.'
        });
    } catch (error) {
        console.error('Error deleting replacement:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Get candidates matching the replacement's job
// @route   GET /api/replacements/:id/candidates
// @access  Private (Admin)
exports.getReplacementCandidates = async (req, res) => {
    try {
        const replacement = await Replacement.findById(req.params.id).populate('job');
        
        if (!replacement) {
            return res.status(404).json({ success: false, message: 'Replacement request not found' });
        }

        let query = { profileStatus: 'active' };

        if (replacement.job) {
            const job = replacement.job;
            // Match based on jobCategory, and optionally state/city if needed
            if (job.jobCategory) {
                query['jobPreference.jobCategory'] = job.jobCategory;
            }
        } else {
            // Fallback to replacement category
            if (replacement.category === 'Commercial') {
                query['jobPreference.jobCategory'] = 'hotel';
            } else {
                query['jobPreference.jobCategory'] = { $in: ['home', 'daily'] };
            }
        }

        const candidates = await Candidate.find(query)
            .select('name phone email city state jobPreference profileImage')
            .limit(50); // Limit to 50 for performance

        res.status(200).json({
            success: true,
            data: candidates
        });
    } catch (error) {
        console.error('Error fetching candidates for replacement:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Assign a candidate to the replacement
// @route   PUT /api/replacements/:id/assign-candidate
// @access  Private (Admin)
exports.assignCandidate = async (req, res) => {
    try {
        const { candidateId } = req.body;
        
        const replacement = await Replacement.findById(req.params.id);
        
        if (!replacement) {
            return res.status(404).json({ success: false, message: 'Replacement request not found' });
        }
        
        replacement.assignedCandidate = candidateId;
        replacement.status = 'In Progress';
        
        await replacement.save();
        
        // Send notification to candidate via FCM
        const notificationController = require('./notificationController');
        notificationController.sendNotificationToUser({
            userId: candidateId,
            userModel: 'Candidate',
            title: '🌟 Job Application',
            message: 'You have been applied for this job as a replacement.',
            type: 'candidate_assigned',
            relatedId: replacement._id,
            relatedModel: 'Replacement',
            actionUrl: '/applications'
        }).catch(err => console.error('Error sending candidate assigned push notification:', err));
        
        // Send notification to Customer (Book a Chef app) via FCM
        if (replacement.customer) {
            notificationController.sendNotificationToUser({
                userId: replacement.customer,
                userModel: 'User',
                title: '✅ Replacement Assigned',
                message: 'Your replacement request has been accepted and a candidate has been assigned.',
                type: 'replacement_assigned',
                relatedId: replacement._id,
                relatedModel: 'Replacement',
                actionUrl: '/replacement_history'
            }).catch(err => console.error('Error sending customer replacement push notification:', err));
        }
        
        res.status(200).json({
            success: true,
            data: replacement,
            message: 'Candidate assigned successfully. Status updated to In Progress.'
        });
    } catch (error) {
        console.error('Error assigning candidate:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Mark replacement as resolved / shortlist candidate
// @route   PUT /api/replacements/:id/resolve
// @access  Private (Admin)
exports.resolveReplacement = async (req, res) => {
    try {
        const replacement = await Replacement.findById(req.params.id);
        
        if (!replacement) {
            return res.status(404).json({ success: false, message: 'Replacement request not found' });
        }

        if (!replacement.assignedCandidate) {
            return res.status(400).json({ success: false, message: 'No candidate assigned to this replacement yet.' });
        }

        replacement.status = 'Resolved';
        await replacement.save();

        // Optionally, if there's a linked job, create an Application for the candidate
        if (replacement.job) {
            // Check if application already exists
            const existingApp = await Application.findOne({
                job: replacement.job,
                candidate: replacement.assignedCandidate
            });

            if (!existingApp) {
                await Application.create({
                    job: replacement.job,
                    candidate: replacement.assignedCandidate,
                    customer: replacement.customer,
                    status: 'Shortlisted',
                    remarks: 'Assigned and shortlisted via Replacement'
                });
            } else {
                existingApp.status = 'Shortlisted';
                await existingApp.save();
            }
        }
        
        res.status(200).json({
            success: true,
            data: replacement,
            message: 'Replacement marked as Resolved and candidate shortlisted.'
        });
    } catch (error) {
        console.error('Error resolving replacement:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Post a new job based on replacement
// @route   POST /api/replacements/:id/post-job
// @access  Private (Admin)
exports.postReplacementJob = async (req, res) => {
    try {
        const replacement = await Replacement.findById(req.params.id).populate('job');
        
        if (!replacement) {
            return res.status(404).json({ success: false, message: 'Replacement request not found' });
        }

        if (!replacement.job) {
            return res.status(400).json({ success: false, message: 'No job linked to this replacement to duplicate.' });
        }

        const oldJob = replacement.job;

        // Create a duplicate of the old job
        const newJobData = {
            jobCategory: oldJob.jobCategory,
            overview: oldJob.overview,
            responsibilities: oldJob.responsibilities,
            requirements: oldJob.requirements,
            benefits: oldJob.benefits,
            title: oldJob.title,
            customer: oldJob.customer,
            propertyCategory: oldJob.propertyCategory,
            state: oldJob.state,
            city: oldJob.city,
            latitude: oldJob.latitude,
            longitude: oldJob.longitude,
            event: oldJob.event,
            foodPreference: oldJob.foodPreference,
            mealPreference: oldJob.mealPreference,
            servingTime: oldJob.servingTime,
            basicFacility: oldJob.basicFacility,
            otherFacilities: oldJob.otherFacilities,
            cookingCategory: oldJob.cookingCategory,
            menuDetails: oldJob.menuDetails,
            image: oldJob.image,
            status: 'Active', // Set new job to active
            jobType: oldJob.jobType,
            jobPosition: oldJob.jobPosition,
            packageOrGuestOrVacancy: oldJob.packageOrGuestOrVacancy,
            package: oldJob.package,
            noOfGuests: oldJob.noOfGuests,
            allowedLeave: oldJob.allowedLeave,
            salaryRange: oldJob.salaryRange,
            experienceRange: oldJob.experienceRange,
            joiningType: oldJob.joiningType,
            travelCharges: oldJob.travelCharges,
            dateOfEvent: oldJob.dateOfEvent,
            isActive: true,
            createdBy: req.admin._id,
            creatorModel: 'Admin'
        };

        const newJob = await Job.create(newJobData);

        // Update the replacement with the new job reference
        replacement.newJob = newJob._id;
        await replacement.save();

        res.status(201).json({
            success: true,
            data: newJob,
            message: 'New job posted successfully for this replacement.'
        });
    } catch (error) {
        console.error('Error posting new job for replacement:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};
