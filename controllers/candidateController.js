const Candidate = require('../models/Candidate');
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
        
        // Handle Multiple Files
        if (req.files) {
            if (req.files.image) candidateData.profileImage = req.files.image[0].path;
            if (req.files.cv) candidateData.cv = req.files.cv[0].path;

            // Handle Documents
            const docs = {};
            if (req.files.idProof) docs.idProof = req.files.idProof[0].path;
            if (req.files.addressProof) docs.addressProof = req.files.addressProof[0].path;
            if (req.files.policeVerification) docs.policeVerification = req.files.policeVerification[0].path;
            if (req.files.cv) docs.resume = req.files.cv[0].path;
            if (req.files.academicCertificate) docs.academicCertificate = req.files.academicCertificate[0].path;
            if (req.files.experienceCertificate) docs.experienceCertificate = req.files.experienceCertificate[0].path;
            
            candidateData.documents = { ...docs, idProofType: candidateData.idProofType || '' };

            // Handle Gallery
            if (req.files.gallery) {
                candidateData.photoGallery = req.files.gallery.map(file => file.path);
            }
        }

        // Set Creator
        candidateData.createdBy = req.admin._id;
        candidateData.creatorModel = req.admin.constructor.modelName;

        // Parse nested fields
        const complexFields = ['languages', 'jobPreference', 'cookingSkills', 'workExperience', 'education', 'careerHighlights', 'socialMedia'];
        complexFields.forEach(field => {
            if (candidateData[field] && typeof candidateData[field] === 'string') {
                try {
                    candidateData[field] = JSON.parse(candidateData[field]);
                } catch (e) {
                    console.log(`Field ${field} is not valid JSON, resetting to default type.`);
                    if (['languages', 'education', 'socialMedia'].includes(field)) {
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
        if (req.files) {
            if (req.files.image) { deleteFile(candidate.profileImage); updateData.profileImage = req.files.image[0].path; }
            if (req.files.cv) { deleteFile(candidate.cv); updateData.cv = req.files.cv[0].path; }

            const docs = candidate.documents ? { ...candidate.documents } : {};
            if (req.files.idProof) { deleteFile(docs.idProof); docs.idProof = req.files.idProof[0].path; }
            if (req.files.addressProof) { deleteFile(docs.addressProof); docs.addressProof = req.files.addressProof[0].path; }
            if (req.files.policeVerification) { deleteFile(docs.policeVerification); docs.policeVerification = req.files.policeVerification[0].path; }
            if (req.files.cv) { deleteFile(docs.resume); docs.resume = req.files.cv[0].path; }
            if (req.files.academicCertificate) { deleteFile(docs.academicCertificate); docs.academicCertificate = req.files.academicCertificate[0].path; }
            if (req.files.experienceCertificate) { deleteFile(docs.experienceCertificate); docs.experienceCertificate = req.files.experienceCertificate[0].path; }
            
            if (Object.keys(docs).length > 0 || updateData.idProofType) {
                updateData.documents = { ...docs, idProofType: updateData.idProofType || docs.idProofType };
            }

            if (req.files.gallery) {
                const newPhotos = req.files.gallery.map(file => file.path);
                updateData.photoGallery = [...(candidate.photoGallery || []), ...newPhotos];
            }
        }

        // Parse nested fields
        const complexFields = ['languages', 'jobPreference', 'cookingSkills', 'workExperience', 'education', 'careerHighlights', 'socialMedia'];
        complexFields.forEach(field => {
            if (updateData[field] && typeof updateData[field] === 'string') {
                try {
                    updateData[field] = JSON.parse(updateData[field]);
                } catch (e) {
                    console.log(`Field ${field} is not valid JSON, resetting to default type.`);
                    if (['languages', 'education', 'socialMedia'].includes(field)) {
                        updateData[field] = [];
                    } else {
                        updateData[field] = {};
                    }
                }
            }
        });

        const updatedCandidate = await Candidate.findByIdAndUpdate(req.params.id, updateData, { new: true });
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
        const { search, city, gender, jobCategory, kycStatus, profileStatus } = req.query;
        let query = {};
        
        // Role-based data isolation
        const isSuperAdmin = req.admin.constructor.modelName === 'Admin';
        if (!isSuperAdmin) {
            query.createdBy = req.admin._id;
        }

        if (search) query.$or = [{ name: new RegExp(search, 'i') }, { phone: new RegExp(search, 'i') }, { email: new RegExp(search, 'i') }];
        if (city) query.city = new RegExp(city, 'i');
        if (gender) query.gender = gender;
        if (kycStatus) query.kycStatus = kycStatus;
        if (profileStatus) query.profileStatus = profileStatus;
        if (jobCategory) query['jobPreference.jobCategory'] = jobCategory;
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
        let matchCriteria = {};
        
        // Role-based data isolation
        const isSuperAdmin = req.admin.constructor.modelName === 'Admin';
        if (!isSuperAdmin) {
            matchCriteria.createdBy = req.admin._id;
        }

        if (status) matchCriteria['applications.status'] = status;
        if (jobId) matchCriteria['applications.job'] = jobId;

        const pipeline = [
            { $unwind: '$applications' },
            { $match: matchCriteria },
            { $lookup: { from: 'jobs', localField: 'applications.job', foreignField: '_id', as: 'jobDetails' } },
            { $unwind: '$jobDetails' }
        ];

        if (search) {
            pipeline.push({
                $match: {
                    $or: [
                        { 'name': new RegExp(search, 'i') },
                        { 'phone': new RegExp(search, 'i') },
                        { 'city': new RegExp(search, 'i') },
                        { 'jobDetails.title': new RegExp(search, 'i') }
                    ]
                }
            });
        }

        pipeline.push({
            $project: { 
                _id: '$applications._id', 
                candidateId: '$_id', 
                candidateName: '$name', 
                candidatePhone: '$phone', 
                candidateCity: '$city', 
                profileImage: '$profileImage', 
                candidateCV: '$cv', 
                jobTitle: '$jobDetails.title', 
                jobId: '$jobDetails._id', 
                jobCategory: '$jobDetails.jobCategory', 
                status: '$applications.status', 
                appliedDate: '$applications.appliedDate' 
            }
        });

        pipeline.push({ $sort: { appliedDate: -1 } });

        const applications = await Candidate.aggregate(pipeline);
        res.status(200).json({ success: true, count: applications.length, applications });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

module.exports = { createCandidate, getCandidates, getCandidate, updateCandidate, deleteCandidate, toggleCandidateStatus, getApplications };
