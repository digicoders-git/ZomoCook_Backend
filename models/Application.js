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
        enum: ['Applied', 'Shortlisted', 'Profile Reviewed', 'Package Selected', 'Package Paid', 'Demo Scheduled', 'Reschedule Requested', 'Hired', 'Rejected', 'On Hold', 'Not Interested', 'Cancelled'],
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
