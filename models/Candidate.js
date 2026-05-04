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
    profileImage: { type: String }, // Path to image
    cv: { type: String }, // Path to CV file (PDF/Doc)

    // Status
    kycStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    profileStatus: { type: String, enum: ['active', 'inactive'], default: 'active' },

    // Job Preference
    jobPreference: {
        jobCategory: [{ type: String }], // hotel, home, daily
        jobType: [{ type: String }], // full-time, part-time, live-in
        experience: {
            value: { type: String, default: '0' },
            unit: { type: String, enum: ['years', 'months'], default: 'years' }
        },
        currentSalary: { type: String },
        expectedSalary: { type: String },
        preferredCities: [{ type: String }],
        jobPositions: [{ type: String }]
    },

    // Additional Sections (Future expansions)
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
    experiences: [{
      position: String,
      from: String,
      to: String,
      jobProfile: String,
      shortDetail: String
    }]
  },
  education: [{
    title: String,
    from: String,
    to: String,
    shortDetail: String
  }],
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
    socialMedia: [{
        platform: String,
        url: String
    }],
    photoGallery: [{ type: String }],

    // Applications tracking
    applications: [{
        job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
        status: { 
            type: String, 
            enum: ['Applied', 'Shortlisted', 'Demo Scheduled', 'Reschedule Requested', 'Hired', 'Rejected', 'On Hold', 'Not Interested'],
            default: 'Applied'
        },
        remarks: { type: String },
        appliedDate: { type: Date, default: Date.now }
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'creatorModel'
    },
    creatorModel: {
        type: String,
        required: true,
        enum: ['Admin', 'User']
    }
}, { timestamps: true });

// Indexing for search
candidateSchema.index({ name: 'text', phone: 'text', email: 'text' });

module.exports = mongoose.model('Candidate', candidateSchema);
