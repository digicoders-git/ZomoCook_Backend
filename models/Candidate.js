const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema({
    // Basic Profile
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    altPhone: { type: String, trim: true },
    dob: { type: Date },
    age: { type: Number },
    gender: { type: String, enum: ['male', 'female', 'other'] },
    maritalStatus: { type: String, enum: ['single', 'married'] },
    state: { type: String, trim: true },
    city: { type: String, trim: true },
    address: { type: String, trim: true },
    languages: [{ type: String }],
    profileImage: { type: String },
    cv: { type: String },

    // ✅ NEW: PROFILE VERIFICATION & APPROVAL WORKFLOW
    profileVerification: {
        // Overall profile status
        status: {
            type: String,
            enum: ['pending_approval', 'approved', 'rejected', 'active'],
            default: 'pending_approval'
        },
        
        // Photo verification
        photoVerified: {
            type: Boolean,
            default: false
        },
        photoVerificationDate: Date,
        photoRejectionReason: String,
        
        // ID verification
        idVerified: {
            type: Boolean,
            default: false
        },
        idVerificationDate: Date,
        idRejectionReason: String,
        
        // Can apply for jobs (only true if approved)
        canApplyForJobs: {
            type: Boolean,
            default: false
        },
        
        // Admin approval details
        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin'
        },
        approvalDate: Date,
        approvalNotes: String,
        
        // Rejection details
        rejectedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin'
        },
        rejectionDate: Date,
        rejectionReason: String,
        
        // Resubmission tracking
        submissionCount: {
            type: Number,
            default: 0
        },
        lastSubmissionDate: Date,
        
        // Verification checklist
        verificationChecklist: {
            photoAppropriate: Boolean,
            photoClarity: Boolean,
            idProofValid: Boolean,
            nameMatches: Boolean,
            ageVerified: Boolean,
            addressVerified: Boolean,
            backgroundCheckPassed: Boolean
        }
    },

    // Status
    kycStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    profileStatus: { type: String, enum: ['active', 'inactive'], default: 'active' },

    // Job Preference
    jobPreference: {
        jobCategory: [{ type: String }],
        jobType: [{ type: String }],
        experience: {
            value: { type: String, default: '0' },
            unit: { type: String, enum: ['years', 'months'], default: 'years' }
        },
        currentSalary: { type: String },
        expectedSalary: { type: String },
        preferredCities: [{ type: String }],
        jobPositions: [{ type: String }]
    },

    // Skills & About
    skills: [{ type: String }],
    about: { type: String, trim: true },

    // Additional Sections
    cookingSkills: { type: Object, default: {} },
    workExperience: {
        lastCompany: {
            name: String,
            workplaceType: String,
            role: String,
            duration: String,
            experienceType: String,
            reasonForLeaving: String
        },
        experiences: [(
            {
                position: String,
                from: String,
                to: String,
                jobProfile: String,
                shortDetail: String
            }
        )]
    },
    education: [
        {
            title: String,
            from: String,
            to: String,
            shortDetail: String
        }
    ],
    careerHighlights: {
        aboutMe: String,
        highlights: [String],
        whyChooseMe: [String]
    },
    documents: {
        idProofType: String,
        idProof: String,
        addressProof: String,
        policeVerification: String,
        resume: String,
        academicCertificate: String,
        experienceCertificate: String
    },
    socialMedia: [
        {
            platform: String,
            url: String
        }
    ],
    photoGallery: [{ type: String }],

    // Saved Jobs
    savedJobs: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Job'
        }
    ],

    // Applications tracking
    applications: [
        {
            job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
            status: {
                type: String,
                enum: ['Applied', 'Shortlisted', 'Demo Scheduled', 'Reschedule Requested', 'Hired', 'Rejected', 'On Hold', 'Not Interested'],
                default: 'Applied'
            },
            remarks: { type: String },
            appliedDate: { type: Date, default: Date.now }
        }
    ],
    
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'creatorModel'
    },
    creatorModel: {
        type: String,
        enum: ['Admin', 'User']
    }
}, { timestamps: true });

// Indexing for search
candidateSchema.index({ name: 'text', phone: 'text', email: 'text' });
candidateSchema.index({ 'profileVerification.status': 1 });
candidateSchema.index({ 'profileVerification.canApplyForJobs': 1 });

module.exports = mongoose.model('Candidate', candidateSchema);
