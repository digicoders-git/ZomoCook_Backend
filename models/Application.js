const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
    job: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Job',
        required: true
    },
    candidate: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Candidate',
        required: true
    },
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['Applied', 'Shortlisted', 'Demo Scheduled', 'Reschedule Requested', 'Hired', 'Rejected', 'On Hold', 'Not Interested'],
        default: 'Applied'
    },
    isViewedByClient: {
        type: Boolean,
        default: false
    },
    notifiedAppliedNotViewed: {
        type: Boolean,
        default: false
    },
    notifiedViewedNoPackage: {
        type: Boolean,
        default: false
    },
    applicationData: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    demoDate: Date,
    demoTime: String,
    meetingLink: String,
    remarks: String,
    rejectionReason: String,
    joiningDate: Date,
    appliedDate: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Unique index to prevent duplicate applications
applicationSchema.index({ job: 1, candidate: 1 }, { unique: true });

module.exports = mongoose.model('Application', applicationSchema);
