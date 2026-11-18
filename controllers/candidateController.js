const Candidate = require('../models/Candidate');
const Application = require('../models/Application');
const Job = require('../models/Job');
const fs = require('fs');
const path = require('path');
const { hasPermission } = require('../middleware/permissionHelper');

// Helper to delete file if exists
const deleteFile = (filePath) => {
    if (filePath && fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (e) { console.error('Error deleting file:', e); }
    }
};

/**
 * @desc    Create a new candidate profile
 * @route   POST /api/candidates
 */
const createCandidate = async (req, res) => {
    try {
        const candidateData = { ...req.body };
        
        const docs = {};
        // Handle Multiple Files
        if (req.files) {
            if (req.files.image) candidateData.profileImage = req.files.image[0].path;
            if (req.files.cv) candidateData.cv = req.files.cv[0].path;

            // Handle Documents
            if (req.files.idProof) docs.idProof = req.files.idProof[0].path;
            if (req.files.addressProof) docs.addressProof = req.files.addressProof[0].path;
            if (req.files.policeVerification) docs.policeVerification = req.files.policeVerification[0].path;
            if (req.files.cv) docs.resume = req.files.cv[0].path;
            if (req.files.academicCertificate) docs.academicCertificate = req.files.academicCertificate[0].path;
            if (req.files.experienceCertificate) docs.experienceCertificate = req.files.experienceCertificate[0].path;
            
            // Handle Gallery
            if (req.files.gallery) {
                candidateData.photoGallery = req.files.gallery.map(file => file.path);
            }
        }

        candidateData.documents = { ...docs, idProofType: candidateData.idProofType || 'Aadhar' };
        delete candidateData.idProofType;

        // Set Creator
        candidateData.createdBy = req.admin._id;
        candidateData.creatorModel = req.admin.constructor.modelName;

        // Parse nested fields
        const complexFields = ['languages', 'jobPreference', 'cookingSkills', 'workExperience', 'education', 'careerHighlights', 'socialMedia', 'skills'];
        complexFields.forEach(field => {
            if (candidateData[field] && typeof candidateData[field] === 'string') {
                try {
                    candidateData[field] = JSON.parse(candidateData[field]);
                } catch (e) {
                    console.log(`Field ${field} is not valid JSON, resetting to default type.`);
                    if (['languages', 'education', 'socialMedia', 'skills'].includes(field)) {
                        candidateData[field] = [];
                    } else {
                        candidateData[field] = {};
                    }
                }
            }
        });

        const candidate = await Candidate.create(candidateData);
        res.status(201).json({ success: true, message: 'Candidate created successfully', candidate });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Update candidate profile
 */
const updateCandidate = async (req, res) => {
    try {
        const candidate = await Candidate.findById(req.params.id);
        if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });

        const updateData = { ...req.body };

        // Only Super Admin can assign or change Lead Manager
        const roleName = (req.admin?.role?.name || '').toLowerCase();
        const isSuperAdmin = (req.admin?.email?.toLowerCase() === 'zomocookadmin@gmail.com') ||
            roleName === 'super admin' ||
            (req.admin?.type === 'admin' && !req.admin?.role);

        if (!isSuperAdmin) {
            delete updateData.leadManager;
        }
        
        // Handle New Files
        const docs = candidate.documents ? { ...candidate.documents } : {};
        if (req.files) {
            if (req.files.image) { deleteFile(candidate.profileImage); updateData.profileImage = req.files.image[0].path; }
            if (req.files.cv) { deleteFile(candidate.cv); updateData.cv = req.files.cv[0].path; }

            if (req.files.idProof) { deleteFile(docs.idProof); docs.idProof = req.files.idProof[0].path; }
            if (req.files.addressProof) { deleteFile(docs.addressProof); docs.addressProof = req.files.addressProof[0].path; }
            if (req.files.policeVerification) { deleteFile(docs.policeVerification); docs.policeVerification = req.files.policeVerification[0].path; }
            if (req.files.cv) { deleteFile(docs.resume); docs.resume = req.files.cv[0].path; }
            if (req.files.academicCertificate) { deleteFile(docs.academicCertificate); docs.academicCertificate = req.files.academicCertificate[0].path; }
            if (req.files.experienceCertificate) { deleteFile(docs.experienceCertificate); docs.experienceCertificate = req.files.experienceCertificate[0].path; }
            
            if (req.files.gallery) {
                const newPhotos = req.files.gallery.map(file => file.path);
                updateData.photoGallery = [...(candidate.photoGallery || []), ...newPhotos];
            }
        }

        if (Object.keys(docs).length > 0 || updateData.idProofType) {
            updateData.documents = { ...docs, idProofType: updateData.idProofType || docs.idProofType };
            delete updateData.idProofType;
        }

        // Parse nested fields
        const complexFields = ['languages', 'jobPreference', 'cookingSkills', 'workExperience', 'education', 'careerHighlights', 'socialMedia', 'skills'];
        complexFields.forEach(field => {
            if (updateData[field] && typeof updateData[field] === 'string') {
                try {
                    updateData[field] = JSON.parse(updateData[field]);
                } catch (e) {
                    console.log(`Field ${field} is not valid JSON, resetting to default type.`);
                    if (['languages', 'education', 'socialMedia', 'skills'].includes(field)) {
                        updateData[field] = [];
                    } else {
                        updateData[field] = {};
                    }
                }
            }
        });

        const wasApproved = candidate.kycStatus === 'approved';
        
        if (updateData.kycStatus === 'approved') {
            updateData['profileVerification.status'] = 'approved';
            updateData['profileVerification.canApplyForJobs'] = true;
            updateData['profileVerification.approvalDate'] = new Date();
        } else if (updateData.kycStatus === 'rejected') {
            updateData['profileVerification.status'] = 'rejected';
            updateData['profileVerification.canApplyForJobs'] = false;
            updateData['profileVerification.rejectionDate'] = new Date();
        }
        
        const updatedCandidate = await Candidate.findByIdAndUpdate(req.params.id, updateData, { new: true });
        
        // Send notification if KYC status changed to approved
        if (!wasApproved && updateData.kycStatus === 'approved') {
            const notificationController = require('./notificationController');
            notificationController.sendNotificationToUser({
                userId: updatedCandidate._id,
                userModel: 'Candidate',
                title: '🎉 Congratulations! Your Profile Has Been Activated',
                message: 'Your profile is activated. You can now apply for jobs.',
                type: 'profile_status',
                relatedId: updatedCandidate._id,
                relatedModel: 'Candidate',
                actionUrl: '/jobs'
            }).catch(err => console.error('Error sending profile activation notification:', err));
        }

        res.status(200).json({ success: true, message: 'Candidate updated successfully', candidate: updatedCandidate });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Delete candidate
 */
const deleteCandidate = async (req, res) => {
    try {
        const candidate = await Candidate.findById(req.params.id);
        if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });

        deleteFile(candidate.profileImage);
        deleteFile(candidate.cv);
        if (candidate.documents) {
            Object.values(candidate.documents).forEach(path => { if (typeof path === 'string' && path.startsWith('uploads/')) deleteFile(path); });
        }
        if (candidate.photoGallery) {
            candidate.photoGallery.forEach(path => deleteFile(path));
        }

        await candidate.deleteOne();
        res.status(200).json({ success: true, message: 'Candidate deleted' });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const getCandidates = async (req, res) => {
    try {
        const { search, city, gender, kycStatus, profileStatus, leadManager } = req.query;
        let query = {};
        
        // Role-based data isolation
        const roleName = (req.admin.role?.name || '').toLowerCase();
        const isSuperAdmin = (req.admin.constructor.modelName === 'Admin' && roleName !== 'lead manager') || 
            roleName === 'super admin';
        const isClient = req.admin.role && ['user', 'customer'].includes(roleName);

        if (isClient) {
            query.profileStatus = 'active';
        } else if (!isSuperAdmin) {
            // Staff User / Lead Manager — show only assigned candidates
            const escapedName = req.admin.name ? req.admin.name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&').trim() : '';
            const escapedEmail = req.admin.email ? req.admin.email.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&').trim() : '';
            
            const assignedJobs = await Job.find({
                $or: [
                    { leadManager: req.admin._id.toString() },
                    { leadManager: new RegExp(`^\\s*${escapedName}\\s*$`, 'i') },
                    { leadManager: new RegExp(`^\\s*${escapedEmail}\\s*$`, 'i') }
                ]
            }).select('_id');
            const assignedJobIds = assignedJobs.map(j => j._id);
            const assignedApps = await Application.find({ job: { $in: assignedJobIds } }).select('candidate');
            const candidateIdsFromJobs = assignedApps.map(a => a.candidate?.toString()).filter(Boolean);

            query.$or = [
                { leadManager: req.admin._id.toString() },
                { leadManager: new RegExp(`^\\s*${escapedName}\\s*$`, 'i') },
                { leadManager: new RegExp(`^\\s*${escapedEmail}\\s*$`, 'i') },
                ...(candidateIdsFromJobs.length > 0 ? [{ _id: { $in: candidateIdsFromJobs } }] : [])
            ];
        }

        if (leadManager) query.leadManager = leadManager;
        if (city) query.city = new RegExp(city, 'i');
        if (gender) query.gender = gender;
        if (kycStatus) query.kycStatus = kycStatus;
        if (profileStatus) query.profileStatus = profileStatus;
        if (search) {
            query.$and = query.$and || [];
            query.$and.push({
                $or: [
                    { name: new RegExp(search, 'i') },
                    { phone: new RegExp(search, 'i') },
                    { email: new RegExp(search, 'i') },
                    { city: new RegExp(search, 'i') }
                ]
            });
        }
        const candidates = await Candidate.find(query).sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: candidates.length, candidates });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const getCandidate = async (req, res) => {
    try {
        const mongoose = require('mongoose');
        let candidate = null;
        if (mongoose.Types.ObjectId.isValid(req.params.id)) {
            candidate = await Candidate.findById(req.params.id).populate('applications.job');
            if (!candidate) {
                candidate = await Candidate.findOne({ createdBy: req.params.id }).populate('applications.job');
            }
        }
        if (!candidate) {
            const last10 = req.params.id.toString().slice(-10);
            if (last10.length === 10 && /^\d+$/.test(last10)) {
                candidate = await Candidate.findOne({ phone: new RegExp(last10 + '$') }).populate('applications.job');
            }
        }
        if (!candidate) {
            const User = require('../models/User');
            let user = null;
            if (mongoose.Types.ObjectId.isValid(req.params.id)) {
                user = await User.findById(req.params.id);
            }
            if (!user) {
                const last10 = req.params.id.toString().slice(-10);
                if (last10.length === 10 && /^\d+$/.test(last10)) {
                    user = await User.findOne({ phone: new RegExp(last10 + '$') });
                }
            }
            if (user) {
                const last10 = user.phone ? user.phone.slice(-10) : '';
                candidate = await Candidate.findOne({
                    $or: [
                        { _id: user._id },
                        { createdBy: user._id },
                        { phone: last10 ? new RegExp(last10 + '$') : user.phone }
                    ]
                }).populate('applications.job');
                if (!candidate) {
                    candidate = await Candidate.create({
                        name: (user.name && !user.name.startsWith('User_') && !user.name.startsWith('Cook_')) ? user.name : 'Enter Full Name',
                        phone: user.phone,
                        email: user.email || undefined,
                        createdBy: user._id,
                        creatorModel: 'User'
                    });
                }
            }
        }
        if (!candidate && mongoose.Types.ObjectId.isValid(req.params.id)) {
            const Application = require('../models/Application');
            const app = await Application.findById(req.params.id);
            if (app && app.candidate) {
                candidate = await Candidate.findById(app.candidate).populate('applications.job');
            }
        }
        if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });
        
        // Dynamically compute rating from approved reviews
        let candObj = candidate.toObject ? candidate.toObject() : { ...candidate };
        try {
            const Review = require('../models/Review');
            const approvedReviews = await Review.find({
                status: 'approved',
                $or: [
                    { cook: candidate._id },
                    { cookUser: candidate.createdBy },
                    { cookName: new RegExp(`^${(candidate.name || '').trim()}$`, 'i') }
                ]
            });
            if (approvedReviews && approvedReviews.length > 0) {
                const sum = approvedReviews.reduce((acc, r) => acc + (r.rating || 5), 0);
                candObj.rating = parseFloat((sum / approvedReviews.length).toFixed(1));
                candObj.totalReviews = approvedReviews.length;
            } else if (!candObj.rating || candObj.rating === 0) {
                candObj.rating = 5.0;
                candObj.totalReviews = 0;
            }
        } catch (revErr) {
            console.error('Error computing dynamic candidate rating:', revErr);
        }

        res.status(200).json({ success: true, candidate: candObj });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const toggleCandidateStatus = async (req, res) => {
    try {
        const { type, value } = req.body;
        const update = {};
        if (type === 'kyc') {
            update.kycStatus = value;
            if (value === 'approved') {
                update['profileVerification.status'] = 'approved';
                update['profileVerification.canApplyForJobs'] = true;
                update['profileVerification.approvalDate'] = new Date();
            } else if (value === 'rejected') {
                update['profileVerification.status'] = 'rejected';
                update['profileVerification.canApplyForJobs'] = false;
                update['profileVerification.rejectionDate'] = new Date();
            }
        }
        else if (type === 'profile') update.profileStatus = value;
        
        const candidateBefore = await Candidate.findById(req.params.id);
        if (!candidateBefore) return res.status(404).json({ success: false, message: 'Candidate not found' });
        
        const wasApproved = candidateBefore.kycStatus === 'approved';
        
        const candidate = await Candidate.findByIdAndUpdate(req.params.id, update, { new: true });
        
        // Trigger notification if KYC status changed to approved
        if (type === 'kyc' && !wasApproved && value === 'approved') {
            if (candidate && candidate.phone) {
                const User = require('../models/User');
                const last10 = candidate.phone.replace(/\D/g, '').slice(-10);
                if (last10) {
                    await User.updateMany({ phone: new RegExp(last10 + '$') }, { status: 'Active' });
                }
            }
            const notificationController = require('./notificationController');
            notificationController.sendNotificationToUser({
                userId: candidate._id,
                userModel: 'Candidate',
                title: '🎉 Congratulations! Your Profile Has Been Activated',
                message: 'Your profile is activated. You can now apply for jobs.',
                type: 'profile_status',
                relatedId: candidate._id,
                relatedModel: 'Candidate',
                actionUrl: '/jobs'
            }).catch(err => console.error('Error sending profile activation notification:', err));
        }

        res.status(200).json({ success: true, message: 'Status updated', candidate });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const getApplications = async (req, res) => {
    try {
        const { status, jobId, search } = req.query;
        let query = {};
        
        // Role-based data isolation
        const isSuperAdmin = req.admin.constructor.modelName === 'Admin';
        const isCook = req.admin.role && req.admin.role.name && req.admin.role.name.toLowerCase() === 'cook';
        const isClient = req.admin.role && ['user', 'customer'].includes(req.admin.role.name.toLowerCase());
        const canViewCandidates = hasPermission(req.admin, 'candidates:view');
        const isStaffUser = !isSuperAdmin && req.admin.role && !['cook', 'user', 'customer'].includes(req.admin.role.name.toLowerCase());
        const isManager = req.admin.role && ['manager', 'super admin', 'admin'].includes(req.admin.role.name.toLowerCase());
        
        if (isCook) {
            const last10 = req.admin.phone ? req.admin.phone.slice(-10) : '';
            const candidate = await Candidate.findOne({
                $or: [
                    { _id: req.admin._id },
                    { createdBy: req.admin._id },
                    { phone: last10 ? new RegExp(last10 + '$') : req.admin.phone }
                ]
            });
            if (candidate) {
                query.candidate = candidate._id;
            } else {
                return res.status(200).json({ success: true, count: 0, applications: [] });
            }
        } else if (isClient) {
            query.customer = req.admin._id;
        } else if (!isSuperAdmin) {
            // Staff user (Lead Manager, Telecaller, etc.) — show applications for their assigned jobs or candidates only
            const escapedName = req.admin.name ? req.admin.name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&').trim() : '';
            const escapedEmail = req.admin.email ? req.admin.email.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&').trim() : '';
            const assignedJobs = await Job.find({
                $or: [
                    { leadManager: req.admin._id.toString() },
                    { leadManager: new RegExp(`^\\s*${escapedName}\\s*$`, 'i') },
                    { leadManager: new RegExp(`^\\s*${escapedEmail}\\s*$`, 'i') }
                ]
            }).select('_id');
            const assignedJobIds = assignedJobs.map(j => j._id);

            const assignedCandidates = await Candidate.find({
                $or: [
                    { leadManager: req.admin._id.toString() },
                    { leadManager: new RegExp(`^\\s*${escapedName}\\s*$`, 'i') },
                    { leadManager: new RegExp(`^\\s*${escapedEmail}\\s*$`, 'i') }
                ]
            }).select('_id');
            const assignedCandidateIds = assignedCandidates.map(c => c._id);

            query.$or = [
                { job: { $in: assignedJobIds } },
                { candidate: { $in: assignedCandidateIds } }
            ];
        }

        if (status) query.status = status;
        if (jobId) query.job = jobId;

        const applications = await Application.find(query)
            .populate('candidate')
            .populate('job')
            .populate('customer', 'name email phone outletName')
            .sort({ appliedDate: -1 });

        const searchRegex = search ? new RegExp(search, 'i') : null;
        const mappedApplications = applications
            .filter((app) => {
                if (!searchRegex) return true;
                const candidate = app.candidate || {};
                const job = app.job || {};
                return searchRegex.test(candidate.name || '') ||
                    searchRegex.test(candidate.phone || '') ||
                    searchRegex.test(candidate.email || '') ||
                    searchRegex.test(candidate.city || '') ||
                    searchRegex.test(job.title || '');
            })
            .map((app) => {
                const candidate = app.candidate || {};
                const job = app.job || {};
                const customer = app.customer || {};
                return {
                    _id: app._id,
                    applicationId: app._id,
                    candidateId: candidate._id,
                    candidateName: candidate.name,
                    candidatePhone: candidate.phone,
                    candidateEmail: candidate.email,
                    candidateGender: candidate.gender,
                    candidateState: candidate.state,
                    candidateCity: candidate.city,
                    candidateAddress: candidate.address,
                    preferredCities: candidate.jobPreference?.preferredCities || [],
                    profileImage: candidate.profileImage,
                    candidateCV: candidate.cv || candidate.documents?.resume,
                    candidateKycStatus: candidate.kycStatus || 'pending',
                    candidate,
                    jobTitle: job.title,
                    jobId: job._id,
                    jobCategory: job.jobCategory,
                    jobType: job.jobType,
                    jobPosition: app.appliedRole || job.jobPosition,
                    appliedRole: app.appliedRole || '',
                    vacancy: job.packageOrGuestOrVacancy,
                    joiningType: job.joiningType,
                    salaryRange: job.salaryRange,
                    experienceRange: job.experienceRange,
                    jobState: job.state,
                    jobCity: job.city,
                    clientName: customer.outletName || customer.name,
                    customer,
                    job,
                    status: app.status,
                    demoDate: app.demoDate,
                    demoTime: app.demoTime,
                    meetingLink: app.meetingLink,
                    remarks: app.remarks,
                    rejectionReason: app.rejectionReason,
                    joiningDate: app.joiningDate,
                    appliedDate: app.appliedDate,
                    startTrialOtp: app.startTrialOtp,
                    endTrialOtp: app.endTrialOtp,
                    trialOtp: app.trialOtp,
                    trialStatus: app.trialStatus,
                    applicationData: app.applicationData
                };
            });

        res.status(200).json({ success: true, count: mappedApplications.length, applications: mappedApplications });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const getCandidateMe = async (req, res) => {
    try {
        const last10 = req.admin.phone ? req.admin.phone.slice(-10) : '';
        let candidate = await Candidate.findOne({
            $or: [
                { _id: req.admin._id },
                { createdBy: req.admin._id },
                { phone: last10 ? new RegExp(last10 + '$') : req.admin.phone }
            ]
        }).populate('applications.job');
        
        if (!candidate) {
            candidate = await Candidate.create({
                name: req.admin.name || `User_${req.admin.phone.slice(-4)}`,
                phone: req.admin.phone,
                email: req.admin.email || undefined,
                createdBy: req.admin._id,
                creatorModel: 'User'
            });
        }

        // Dynamically attach rating from approved reviews
        let candObj = candidate.toObject ? candidate.toObject() : { ...candidate };
        try {
            const Review = require('../models/Review');
            const approvedReviews = await Review.find({
                status: 'approved',
                $or: [
                    { cook: candidate._id },
                    { cookUser: candidate.createdBy },
                    { cookName: new RegExp(`^${(candidate.name || '').trim()}$`, 'i') }
                ]
            });
            if (approvedReviews && approvedReviews.length > 0) {
                const sum = approvedReviews.reduce((acc, r) => acc + (r.rating || 5), 0);
                candObj.rating = parseFloat((sum / approvedReviews.length).toFixed(1));
                candObj.totalReviews = approvedReviews.length;
            } else if (!candObj.rating || candObj.rating === 0) {
                candObj.rating = 5.0;
                candObj.totalReviews = 0;
            }
        } catch (revErr) {
            console.error('Error attaching candidate review rating in getCandidateMe:', revErr);
        }

        res.status(200).json({ success: true, candidate: candObj });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateCandidateMe = async (req, res) => {
    try {
        const last10 = req.admin.phone ? req.admin.phone.slice(-10) : '';
        let candidate = await Candidate.findOne({
            $or: [
                { _id: req.admin._id },
                { createdBy: req.admin._id },
                { phone: last10 ? new RegExp(last10 + '$') : req.admin.phone }
            ]
        });
        
        if (!candidate) {
            candidate = await Candidate.create({
                name: req.admin.name || `User_${req.admin.phone.slice(-4)}`,
                phone: req.admin.phone,
                email: req.admin.email || undefined,
                createdBy: req.admin._id,
                creatorModel: 'User'
            });
        }

        const updateData = { ...req.body };
        
        // Handle New Files
        const docs = candidate.documents ? { ...candidate.documents } : {};
        if (req.files) {
            if (req.files.image) { deleteFile(candidate.profileImage); updateData.profileImage = req.files.image[0].path; }
            if (req.files.cv) { deleteFile(candidate.cv); updateData.cv = req.files.cv[0].path; }

            if (req.files.idProof) { deleteFile(docs.idProof); docs.idProof = req.files.idProof[0].path; }
            if (req.files.addressProof) { deleteFile(docs.addressProof); docs.addressProof = req.files.addressProof[0].path; }
            if (req.files.policeVerification) { deleteFile(docs.policeVerification); docs.policeVerification = req.files.policeVerification[0].path; }
            if (req.files.cv) { deleteFile(docs.resume); docs.resume = req.files.cv[0].path; }
            if (req.files.academicCertificate) { deleteFile(docs.academicCertificate); docs.academicCertificate = req.files.academicCertificate[0].path; }
            if (req.files.experienceCertificate) { deleteFile(docs.experienceCertificate); docs.experienceCertificate = req.files.experienceCertificate[0].path; }
            
            if (req.files.gallery) {
                const newPhotos = req.files.gallery.map(file => file.path);
                updateData.photoGallery = [...(candidate.photoGallery || []), ...newPhotos];
            }
        }

        if (Object.keys(docs).length > 0 || updateData.idProofType) {
            updateData.documents = { ...docs, idProofType: updateData.idProofType || docs.idProofType };
            delete updateData.idProofType;
        }

        // Parse nested fields
        const complexFields = ['languages', 'jobPreference', 'cookingSkills', 'workExperience', 'education', 'careerHighlights', 'socialMedia', 'skills'];
        complexFields.forEach(field => {
            if (updateData[field] && typeof updateData[field] === 'string') {
                try {
                    updateData[field] = JSON.parse(updateData[field]);
                } catch (e) {
                    console.log(`Field ${field} is not valid JSON, resetting to default type.`);
                    if (['languages', 'education', 'socialMedia', 'skills'].includes(field)) {
                        updateData[field] = [];
                    } else {
                        updateData[field] = {};
                    }
                }
            }
        });

        updateData.isProfileComplete = true;
        const updatedCandidate = await Candidate.findByIdAndUpdate(candidate._id, updateData, { new: true });
        const User = require('../models/User');
        await User.findByIdAndUpdate(req.admin._id, { isProfileComplete: true });
        res.status(200).json({ success: true, message: 'Candidate updated successfully', candidate: updatedCandidate });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const generateResumeHtml = async (req, res) => {
    try {
        const mongoose = require('mongoose');
        let candidate = null;
        if (mongoose.Types.ObjectId.isValid(req.params.id)) {
            candidate = await Candidate.findById(req.params.id);
            if (!candidate) {
                candidate = await Candidate.findOne({ createdBy: req.params.id });
            }
        }
        if (!candidate) {
            const last10 = req.params.id.toString().slice(-10);
            if (last10.length === 10 && /^\d+$/.test(last10)) {
                candidate = await Candidate.findOne({ phone: new RegExp(last10 + '$') });
            }
        }
        if (!candidate) {
            return res.status(404).send('<h1>Candidate Not Found</h1>');
        }

        const logoPath = path.join(__dirname, '../uploads/logo.png');
        let logoBase64 = '';
        if (fs.existsSync(logoPath)) {
            logoBase64 = `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;
        }

        const rawExp = candidate.jobPreference?.experience?.value ?? candidate.experience ?? '0';
        const parsedExp = parseInt(rawExp, 10);
        const expVal = isNaN(parsedExp) ? rawExp : parsedExp;
        const expUnit = candidate.jobPreference?.experience?.unit || 'years';
        const expText = `${expVal}+ ${expUnit.charAt(0).toUpperCase() + expUnit.slice(1)}`;
        const titleText = candidate.jobPreference?.jobPositions?.[0] || candidate.jobPreference?.jobCategory?.[0] || 'Executive Chef';

        let profileImageSrc = '';
        if (candidate.profileImage) {
            if (candidate.profileImage.startsWith('data:image')) {
                profileImageSrc = candidate.profileImage;
            } else if (candidate.profileImage.startsWith('http')) {
                profileImageSrc = candidate.profileImage;
            } else {
                const cleanRel = candidate.profileImage.replace(/^[/\\]+/, '').replace(/^uploads[/\\]+/, '');
                const diskPath = path.join(__dirname, '../uploads', cleanRel);
                if (fs.existsSync(diskPath)) {
                    const ext = path.extname(diskPath).toLowerCase().replace('.', '') || 'jpeg';
                    const mime = ext === 'jpg' ? 'jpeg' : (ext === 'png' ? 'png' : (ext === 'webp' ? 'webp' : 'jpeg'));
                    profileImageSrc = `data:image/${mime};base64,${fs.readFileSync(diskPath).toString('base64')}`;
                } else {
                    profileImageSrc = '/' + candidate.profileImage.replace(/\\/g, '/').replace(/^\/+/, '');
                }
            }
        }

        const calculateAge = (dob) => {
            if (!dob) return null;
            const diff = Date.now() - new Date(dob).getTime();
            const age = new Date(diff).getUTCFullYear() - 1970;
            return Math.abs(age);
        };
        const computedAge = candidate.age || calculateAge(candidate.dob) || 'N/A';

        const skillsList = candidate.skills?.length > 0 ? candidate.skills : ['Table Service', 'Customer Handling', 'Food & Beverage Service', 'POS Basic', 'Hygiene & Cleanliness'];
        const personalDetails = {
            age: computedAge !== 'N/A' ? `${computedAge} Years` : 'N/A',
            gender: candidate.gender ? (candidate.gender.charAt(0).toUpperCase() + candidate.gender.slice(1)) : 'N/A',
            maritalStatus: candidate.maritalStatus ? (candidate.maritalStatus.charAt(0).toUpperCase() + candidate.maritalStatus.slice(1)) : 'Single',
            languages: candidate.languages?.length ? candidate.languages.join(', ') : 'Hindi, English'
        };

        const experiences = candidate.workExperience?.experiences || [];
        const lastCompany = candidate.workExperience?.lastCompany || {};

        let experienceHtml = '';
        if (lastCompany.name) {
            let dur = (lastCompany.duration || '').toString().trim();
            if (dur && !isNaN(parseInt(dur, 10)) && !dur.toLowerCase().includes('year') && !dur.toLowerCase().includes('month')) {
                dur = `${parseInt(dur, 10)} ${parseInt(dur, 10) === 1 ? 'Year' : 'Years'}`;
            }
            experienceHtml += `
                <div class="mb-3.5">
                    <div class="flex justify-between items-baseline mb-0.5">
                        <h4 class="font-extrabold text-slate-800 text-xs uppercase tracking-wide">${lastCompany.name}</h4>
                        <span class="text-[10px] font-bold text-[#0056D2]">${dur || 'Recent'}</span>
                    </div>
                    <p class="text-[11px] font-bold text-[#0056D2]">${lastCompany.role || 'Chef'}</p>
                    <ul class="list-disc pl-4 text-[10px] text-slate-600 space-y-0.5 mt-1 font-normal">
                        <li>Delivered high-quality food preparation and maintained kitchen hygiene standards.</li>
                        <li>Coordinated with team members and ensured excellent service standards.</li>
                    </ul>
                </div>
            `;
        }

        if (experiences.length > 0) {
            experienceHtml += experiences.map(exp => `
                <div class="mb-3.5">
                    <div class="flex justify-between items-baseline mb-0.5">
                        <h4 class="font-extrabold text-slate-800 text-xs uppercase tracking-wide">${exp.jobProfile || exp.position || 'Chef'}</h4>
                        <span class="text-[10px] font-bold text-[#0056D2]">${exp.from || ''}${exp.to ? ` - ${exp.to}` : ''}</span>
                    </div>
                    ${exp.position && exp.position !== exp.jobProfile ? `<p class="text-[11px] font-bold text-[#0056D2]">${exp.position}</p>` : ''}
                    ${exp.shortDetail ? `<p class="text-[10px] text-slate-600 mt-1">${exp.shortDetail}</p>` : ''}
                </div>
            `).join('');
        }

        if (!experienceHtml) {
            experienceHtml = `
                <div class="mb-3.5">
                    <h4 class="font-bold text-slate-800 text-xs">Professional Cook / Chef</h4>
                    <p class="text-[10px] text-[#0056D2] font-semibold">Self-Employed / Freelancer</p>
                    <p class="text-[10px] text-slate-600 mt-1">Experienced in preparing delicious home & commercial meals according to client tastes and requirements.</p>
                </div>
            `;
        }

        const education = candidate.education || [];
        let educationHtml = '';
        if (education.length > 0) {
            educationHtml = `
                <div class="mt-4">
                    <h3 class="text-[10px] font-extrabold tracking-widest text-[#0056D2] uppercase border-b border-[#0056D2]/30 pb-1 mb-2">Education</h3>
                    <div class="space-y-2">
                        ${education.map(edu => `
                            <div>
                                <div class="flex justify-between items-baseline">
                                    <h5 class="text-[11px] font-bold text-slate-800">${edu.title || 'Degree / Diploma'}</h5>
                                    <span class="text-[10px] font-bold text-[#0056D2]">${edu.from || ''}${edu.to ? ` - ${edu.to}` : ''}</span>
                                </div>
                                ${edu.shortDetail ? `<p class="text-[10px] text-slate-600">${edu.shortDetail}</p>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        const expSalaryNum = parseInt(candidate.jobPreference?.expectedSalary, 10);
        const curSalaryNum = parseInt(candidate.jobPreference?.currentSalary, 10);
        const expSalaryText = !isNaN(expSalaryNum) && expSalaryNum > 0 ? `₹${expSalaryNum} - ₹${expSalaryNum + 5000} / Month` : 'Not Disclosed';
        const curSalaryText = !isNaN(curSalaryNum) && curSalaryNum > 0 ? `₹${curSalaryNum} - ₹${curSalaryNum + 5000} / Month` : 'Not Disclosed';

        const isPreviewOnly = req.query.preview === 'true';

        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${candidate.name} - Resume | ZomoCook</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
    <style>
        body {
            font-family: 'Outfit', sans-serif;
            background-color: #f1f5f9;
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
        }
        @media print {
            body {
                background-color: #ffffff;
            }
            .no-print {
                display: none !important;
            }
        }
    </style>
</head>
<body class="flex flex-col items-center justify-start min-h-screen py-4 sm:py-8">

    <!-- Status Toast / Loader -->
    <div id="status-container" class="no-print w-full max-w-[794px] mb-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center px-6">
        <div class="flex items-center gap-3">
            <div id="status-spinner" class="animate-spin rounded-full h-5 w-5 border-2 border-[#0056D2] border-t-transparent ${isPreviewOnly ? 'hidden' : ''}"></div>
            <span id="status-text" class="text-slate-700 text-sm font-bold">
                ${isPreviewOnly ? 'Official ZomoCook Verified Resume' : 'Generating and downloading official resume PDF...'}
            </span>
        </div>
        <div class="flex items-center gap-2">
            <button onclick="downloadPDF()" class="bg-[#0056D2] hover:bg-blue-700 text-white font-bold text-xs py-2 px-4 rounded-lg shadow-sm transition-all flex items-center gap-1.5">
                <span>⬇️</span> Download PDF
            </button>
        </div>
    </div>

    <!-- Resume A4 Frame -->
    <div id="resume-content" class="w-[794px] h-[1122px] bg-white shadow-xl border border-slate-200 overflow-hidden flex flex-col justify-between" style="box-sizing: border-box;">
        
        <!-- Main Grid -->
        <div class="flex-grow grid grid-cols-12 h-[1012px]">
            
            <!-- Left Column (White) -->
            <div class="col-span-7 p-7 pr-6 flex flex-col justify-between h-full" style="box-sizing: border-box;">
                <div>
                    <!-- Name & Subtitle -->
                    <h1 class="text-3xl font-black text-[#0056D2] leading-tight tracking-tight uppercase">${candidate.name}</h1>
                    <p class="text-xs font-extrabold text-[#0056D2] mt-1 tracking-wide uppercase">${titleText} - ${expText} Experience</p>
                    
                    <!-- Summary Section -->
                    <div class="mt-5">
                        <h3 class="text-[10px] font-extrabold tracking-widest text-[#0056D2] uppercase border-b border-[#0056D2]/30 pb-1 mb-2">Summary</h3>
                        <p class="text-[11px] text-slate-600 leading-relaxed font-normal">
                            ${candidate.about || `Experienced and dedicated hospitality professional with ${expVal}+ ${expUnit.toLowerCase()} of expertise in food service operations, team coordination, guest handling, and maintaining high standards of hygiene and service. Seeking a challenging role to contribute to operational excellence and customer satisfaction.`}
                        </p>
                    </div>

                    <!-- Work Experience -->
                    <div class="mt-5">
                        <h3 class="text-[10px] font-extrabold tracking-widest text-[#0056D2] uppercase border-b border-[#0056D2]/30 pb-1 mb-2">Work Experience</h3>
                        <div class="flex flex-col gap-1">
                            ${experienceHtml}
                        </div>
                    </div>

                    ${educationHtml}
                </div>

                <!-- Additional Details -->
                <div class="mt-4 mb-1 pt-2 border-t border-slate-100">
                    <h3 class="text-[10px] font-extrabold tracking-widest text-[#0056D2] uppercase border-b border-[#0056D2]/30 pb-1 mb-2">Additional Details</h3>
                    <div class="grid grid-cols-2 gap-y-2.5 gap-x-2">
                        <div>
                            <span class="block text-[8px] text-slate-500 font-bold uppercase tracking-wider">Total Experience</span>
                            <span class="text-[11px] font-extrabold text-slate-800">${expText}</span>
                        </div>
                        <div>
                            <span class="block text-[8px] text-slate-500 font-bold uppercase tracking-wider">Expected Salary</span>
                            <span class="text-[11px] font-extrabold text-slate-800">${expSalaryText}</span>
                        </div>
                        <div>
                            <span class="block text-[8px] text-slate-500 font-bold uppercase tracking-wider">Current Salary</span>
                            <span class="text-[11px] font-extrabold text-slate-800">${curSalaryText}</span>
                        </div>
                        <div>
                            <span class="block text-[8px] text-slate-500 font-bold uppercase tracking-wider">Ready to Relocate</span>
                            <span class="text-[11px] font-extrabold text-slate-800">Yes</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Right Column (Blue) -->
            <div class="col-span-5 bg-gradient-to-b from-[#004aad] to-[#0062e6] p-7 text-white flex flex-col justify-between h-full" style="box-sizing: border-box;">
                <div>
                    <!-- Profile Picture Block -->
                    <div class="flex justify-center mb-6">
                        <div class="w-28 h-28 rounded-full border-4 border-white/30 bg-white overflow-hidden flex items-center justify-center shadow-lg">
                            ${profileImageSrc 
                                ? `<img src="${profileImageSrc}" class="w-full h-full object-cover" alt="${candidate.name}" />`
                                : `<svg xmlns="http://www.w3.org/2000/svg" class="h-14 w-14 text-slate-300" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
                                   </svg>`
                            }
                        </div>
                    </div>

                    <!-- Contact Details -->
                    <div class="flex flex-col gap-2.5 mb-6">
                        <div class="flex items-center gap-2.5">
                            <span class="w-5 h-5 rounded-full bg-white flex items-center justify-center text-[10px] text-[#004aad] shadow-sm flex-shrink-0">📍</span>
                            <span class="text-[11px] font-semibold">${[candidate.city, candidate.state].filter(Boolean).join(', ') || candidate.address || 'Lucknow, Uttar Pradesh'}</span>
                        </div>
                        <div class="flex items-center gap-2.5">
                            <span class="w-5 h-5 rounded-full bg-white flex items-center justify-center text-[10px] text-[#004aad] shadow-sm flex-shrink-0">📞</span>
                            <span class="text-[11px] font-semibold">${candidate.phone}</span>
                        </div>
                        <div class="flex items-center gap-2.5">
                            <span class="w-5 h-5 rounded-full bg-white flex items-center justify-center text-[10px] text-[#004aad] shadow-sm flex-shrink-0">✉️</span>
                            <span class="text-[11px] font-semibold break-all">${candidate.email || 'N/A'}</span>
                        </div>
                    </div>

                    <!-- Core Qualifications -->
                    <div class="mb-5">
                        <h3 class="text-[10px] font-extrabold tracking-widest uppercase border-b border-white/20 pb-1 mb-2">Core Qualifications</h3>
                        <ul class="list-disc pl-4 text-[11px] space-y-1 font-light">
                            ${skillsList.slice(0, 6).map(skill => `<li>${skill}</li>`).join('')}
                        </ul>
                    </div>

                    <!-- Personal Details -->
                    <div class="mb-5">
                        <h3 class="text-[10px] font-extrabold tracking-widest uppercase border-b border-white/20 pb-1 mb-2">Personal Details</h3>
                        <div class="space-y-1 text-[11px]">
                            <div class="flex justify-between border-b border-white/10 pb-0.5">
                                <span class="opacity-80">Age</span>
                                <span class="font-bold">${personalDetails.age}</span>
                            </div>
                            <div class="flex justify-between border-b border-white/10 pb-0.5">
                                <span class="opacity-80">Gender</span>
                                <span class="font-bold">${personalDetails.gender}</span>
                            </div>
                            <div class="flex justify-between border-b border-white/10 pb-0.5">
                                <span class="opacity-80">Marital Status</span>
                                <span class="font-bold">${personalDetails.maritalStatus}</span>
                            </div>
                            <div class="flex justify-between border-b border-white/10 pb-0.5">
                                <span class="opacity-80">Languages</span>
                                <span class="font-bold text-right">${personalDetails.languages}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Certifications -->
                    <div>
                        <h3 class="text-[10px] font-extrabold tracking-widest uppercase border-b border-white/20 pb-1 mb-2">Certifications</h3>
                        <ul class="list-disc pl-4 text-[11px] space-y-1 font-light">
                            <li>Verified Profile – ZomoCook</li>
                            <li>Aadhaar & Mobile Verified</li>
                        </ul>
                    </div>
                </div>
            </div>

        </div>

        <!-- Footer Verification Checklist Row -->
        <div class="bg-slate-50 border-t border-b border-slate-200 py-2.5 px-6 flex justify-between items-center h-[50px] w-full" style="box-sizing: border-box;">
            <div class="flex items-center gap-1.5 text-[10px] text-slate-800 font-bold">
                <span class="text-green-600 font-black text-xs">✓</span> Aadhaar Verified
            </div>
            <div class="flex items-center gap-1.5 text-[10px] text-slate-800 font-bold">
                <span class="text-green-600 font-black text-xs">✓</span> Mobile Verified
            </div>
            <div class="flex items-center gap-1.5 text-[10px] text-slate-800 font-bold">
                <span class="text-green-600 font-black text-xs">✓</span> Address Verified
            </div>
            <div class="flex items-center gap-1.5 text-[10px] text-slate-800 font-bold">
                <span class="text-green-600 font-black text-xs">✓</span> Experience Verified
            </div>
            <div class="text-[9px] font-extrabold text-[#0056D2] border border-[#0056D2] py-0.5 px-2.5 rounded-full bg-blue-50/50">
                Profile Reviewed by ZomoCook
            </div>
        </div>

        <!-- Bottom Dark Corporate Bar -->
        <div class="bg-gradient-to-r from-[#004aad] to-[#0062e6] text-white p-3 flex justify-between items-center px-6 h-[60px] w-full" style="box-sizing: border-box;">
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 bg-white rounded-lg flex items-center justify-center p-1 shadow-sm overflow-hidden flex-shrink-0">
                    ${logoBase64 
                        ? `<img src="${logoBase64}" class="w-full h-full object-contain" alt="ZomoCook Logo" />`
                        : `<div class="w-full h-full bg-[#ED1C24] text-white flex items-center justify-center font-black text-xs rounded">Z</div>`
                    }
                </div>
                <div class="text-[9px] leading-tight">
                    <p class="font-extrabold text-white">This profile has been verified by ZomoCook Recruitment Team.</p>
                    <p class="opacity-80">We ensure trusted, skilled & professional staff for your business.</p>
                </div>
            </div>
            <div class="text-[10px] font-bold tracking-wider opacity-90 flex items-center gap-1">
                <span>🌐</span> www.zomocook.com
            </div>
        </div>

    </div>

    <!-- auto download script -->
    <script>
        function downloadPDF() {
            const spinner = document.getElementById('status-spinner');
            const statusText = document.getElementById('status-text');
            
            if (spinner) spinner.style.display = 'block';
            if (statusText) statusText.innerText = 'Generating and downloading official resume PDF...';
            
            const element = document.getElementById('resume-content');
            const opt = {
                margin:       0,
                filename:     'Resume_${candidate.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf',
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2.5, useCORS: true, logging: false },
                jsPDF:        { unit: 'px', format: [794, 1122], orientation: 'portrait' }
            };
            
            html2pdf().set(opt).from(element).save().then(() => {
                if (spinner) spinner.style.display = 'none';
                if (statusText) statusText.innerText = '✅ Resume PDF downloaded successfully!';
                if (window.opener) {
                    setTimeout(() => {
                        window.close();
                    }, 1400);
                }
            }).catch(err => {
                if (spinner) spinner.style.display = 'none';
                if (statusText) statusText.innerText = 'Failed to generate PDF. Click Download PDF to retry.';
                console.error(err);
            });
        }
        
        ${isPreviewOnly ? '' : `
        window.onload = function() {
            setTimeout(downloadPDF, 600);
        };
        `}
    </script>

</body>
</html>
        `;
        
        res.setHeader('Content-Type', 'text/html');
        return res.send(html);
    } catch (error) {
        console.error('Error generating resume HTML:', error);
        res.status(500).send('<h1>Server Error: ' + error.message + '</h1>');
    }
};

module.exports = { 
    createCandidate, 
    getCandidates, 
    getCandidate, 
    updateCandidate, 
    deleteCandidate, 
    toggleCandidateStatus, 
    getApplications,
    getCandidateMe,
    updateCandidateMe,
    generateResumeHtml
};
