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
        enum: ['Applied', 'Shortlisted', 'Profile Reviewed', 'Package Selected', 'Package Paid', 'Demo Scheduled', 'Demo In Progress', 'Demo Completed', 'Demo Cancelled', 'Reschedule Requested', 'Hired', 'Offer Accepted', 'Offer Rejected', 'Rejected by Cook', 'Joined', 'Rejected', 'On Hold', 'Not Interested', 'Cancelled'],
        default: 'Applied'
    },
    offerStatus: {
        type: String,
        enum: ['pending', 'accepted', 'rejected'],
        default: 'pending'
    },
    offerDecisionDate: Date,
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
    servicePackage: {
        type: String,
        enum: ['Basic', 'Standard', 'Premium'],
        default: null
    },
    servicePackagePaymentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServicePackagePayment'
    },
    servicePackagePaid: {
        type: Boolean,
        default: false
    },
    packageSelectedDate: Date,
    packagePaidDate: Date,
    demoDate: Date,
    demoTime: String,
    demoMenu: [String],
    demoNotes: String,
    meetingLink: String,
    rejectionReason: String,
    rejectionNotes: String,
    joiningDate: Date,
    offeredSalary: String,
    appliedDate: {
        type: Date,
        default: Date.now
    },
    // Trial Lifecycle fields
    trialStatus: {
        type: String,
        enum: ['not_started', 'in_progress', 'completed', 'cancelled'],
        default: 'not_started'
    },
    trialStartedAt: Date,
    trialCompletedAt: Date,
    trialCancelledAt: Date,
    trialCancellationReason: String,
    trialCancellationNotes: String,
    trialOtp: String,
    trialOtpExpiresAt: Date,
    trialDurationSeconds: Number
}, { timestamps: true });

// Unique index to prevent duplicate applications
applicationSchema.index({ job: 1, candidate: 1 }, { unique: true });

module.exports = mongoose.model('Application', applicationSchema);
