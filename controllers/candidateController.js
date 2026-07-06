const Candidate = require('../models/Candidate');
const Application = require('../models/Application');
const fs = require('fs');
const path = require('path');

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
        const { search, city, gender, kycStatus, profileStatus } = req.query;
        let query = {};
        
        // Role-based data isolation
        const isSuperAdmin = req.admin.constructor.modelName === 'Admin';
        const isUser = req.admin.constructor.modelName === 'User';
        if (!isSuperAdmin && !isUser) {
            query.createdBy = req.admin._id;
        }

        if (isUser) {
            query.profileStatus = 'active';
        }

        if (search) query.$or = [{ name: new RegExp(search, 'i') }, { phone: new RegExp(search, 'i') }, { email: new RegExp(search, 'i') }];
        if (city) query.city = new RegExp(city, 'i');
        if (gender) query.gender = gender;
        if (kycStatus) query.kycStatus = kycStatus;
        if (profileStatus) query.profileStatus = profileStatus;
        const candidates = await Candidate.find(query).sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: candidates.length, candidates });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const getCandidate = async (req, res) => {
    try {
        const candidate = await Candidate.findById(req.params.id).populate('applications.job');
        if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });
        res.status(200).json({ success: true, candidate });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const toggleCandidateStatus = async (req, res) => {
    try {
        const { type, value } = req.body;
        const update = {};
        if (type === 'kyc') update.kycStatus = value;
        else if (type === 'profile') update.profileStatus = value;
        const candidate = await Candidate.findByIdAndUpdate(req.params.id, update, { new: true });
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
        const isUser = req.admin.constructor.modelName === 'User';
        
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
        } else if (isUser) {
            query.customer = req.admin._id;
        } else if (!isSuperAdmin) {
            query.customer = req.admin._id;
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
                    candidate,
                    jobTitle: job.title,
                    jobId: job._id,
                    jobCategory: job.jobCategory,
                    jobType: job.jobType,
                    jobPosition: job.jobPosition,
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
                    applicationData: app.applicationData
                };
            });

        res.status(200).json({ success: true, count: mappedApplications.length, applications: mappedApplications });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const getCandidateMe = async (req, res) => {
    try {
        const last10 = req.admin.phone ? req.admin.phone.slice(-10) : '';
        const candidate = await Candidate.findOne({
            $or: [
                { _id: req.admin._id },
                { createdBy: req.admin._id },
                { phone: last10 ? new RegExp(last10 + '$') : req.admin.phone }
            ]
        }).populate('applications.job');
        if (!candidate) return res.status(404).json({ success: false, message: 'Candidate profile not found' });
        res.status(200).json({ success: true, candidate });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateCandidateMe = async (req, res) => {
    try {
        const last10 = req.admin.phone ? req.admin.phone.slice(-10) : '';
        const candidate = await Candidate.findOne({
            $or: [
                { _id: req.admin._id },
                { createdBy: req.admin._id },
                { phone: last10 ? new RegExp(last10 + '$') : req.admin.phone }
            ]
        });
        if (!candidate) return res.status(404).json({ success: false, message: 'Candidate profile not found' });

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

        const updatedCandidate = await Candidate.findByIdAndUpdate(candidate._id, updateData, { new: true });
        res.status(200).json({ success: true, message: 'Candidate updated successfully', candidate: updatedCandidate });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
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
    updateCandidateMe
};
