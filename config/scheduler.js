const cron = require('node-cron');
const Job = require('../models/Job');
const Application = require('../models/Application');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Plan = require('../models/Plan');
const notificationController = require('../controllers/notificationController');

const initScheduler = () => {
    console.log('[Scheduler] Initializing background tasks...');

    // Run every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
        console.log('[Scheduler] Running 5-minute automated checks...');
        const now = new Date();

        try {
            // ==========================================
            // 1. Job Posted But Payment Not Made / Inactive
            // ==========================================
            const pendingJobs = await Job.find({
                $or: [
                    { status: 'Inactive' },
                    { isActive: false }
                ]
            });

            for (const job of pendingJobs) {
                const diffMs = now - new Date(job.createdAt);
                const diffMins = Math.floor(diffMs / 60000);
                const diffHours = Math.floor(diffMins / 60);

                let title = '⚠️ Job Activation Required';
                let message = '';
                let updated = false;

                // 24 Hours Check
                if (diffHours >= 24 && !job.paymentReminderSent24Hour) {
                    message = "Your job is still inactive. Activate now before candidates become unavailable.";
                    job.paymentReminderSent24Hour = true;
                    updated = true;
                }
                // 6 Hours Check
                else if (diffHours >= 6 && diffHours < 24 && !job.paymentReminderSent6Hour) {
                    message = "Don't miss qualified candidates. Complete your hiring process today and start receiving shortlisted profiles.";
                    job.paymentReminderSent6Hour = true;
                    updated = true;
                }
                // 1 Hour Check
                else if (diffMins >= 60 && diffHours < 6 && !job.paymentReminderSent1Hour) {
                    message = "Good news! Experienced cooks are available for your requirement. Activate your job now to view profiles.";
                    job.paymentReminderSent1Hour = true;
                    updated = true;
                }
                // 15 Minutes Check
                else if (diffMins >= 15 && diffMins < 60 && !job.paymentReminderSent15Min) {
                    message = "Your job is now live. 3 cooks have already shown interest. Complete payment to start receiving profiles.";
                    job.paymentReminderSent15Min = true;
                    updated = true;
                }

                if (updated && message) {
                    await job.save();
                    await notificationController.sendNotificationToUser({
                        userId: job.createdBy,
                        userModel: 'User',
                        title,
                        message,
                        type: 'job_status',
                        relatedId: job._id,
                        relatedModel: 'Job',
                        actionUrl: '/jobs'
                    });
                }
            }

            // ==========================================
            // 2. Candidates Applied But Client Hasn't Viewed
            // ==========================================
            // Find active jobs and check if they have unviewed applications
            const activeJobs = await Job.find({ isActive: true });
            for (const job of activeJobs) {
                const unviewedApps = await Application.find({
                    job: job._id,
                    status: 'Applied',
                    isViewedByClient: false,
                    notifiedAppliedNotViewed: false
                });

                if (unviewedApps.length > 0) {
                    // Check if at least 10 minutes have passed since the first unviewed application to avoid spam
                    const oldestApp = unviewedApps.reduce((oldest, current) => {
                        return new Date(current.createdAt) < new Date(oldest.createdAt) ? current : oldest;
                    }, unviewedApps[0]);

                    const diffMins = Math.floor((now - new Date(oldestApp.createdAt)) / 60000);
                    if (diffMins >= 10) {
                        const candidateCount = unviewedApps.length;
                        const messages = [
                            `${candidateCount} verified candidates are waiting for your response. Review profiles now.`,
                            "Your next chef could be one click away. View shortlisted candidates."
                        ];
                        // Select message based on count or random rotation
                        const selectedMessage = candidateCount >= 3 ? messages[0] : messages[1];

                        // Mark these applications as notified so we don't spam
                        await Application.updateMany(
                            { _id: { $in: unviewedApps.map(a => a._id) } },
                            { $set: { notifiedAppliedNotViewed: true } }
                        );

                        await notificationController.sendNotificationToUser({
                            userId: job.createdBy,
                            userModel: 'User',
                            title: '📝 Candidates Waiting',
                            message: selectedMessage,
                            type: 'application_status',
                            relatedId: job._id,
                            relatedModel: 'Job',
                            actionUrl: '/applications'
                        });
                    }
                }
            }

            // ==========================================
            // 3. Client Viewed Profiles But Didn't Purchase Package
            // ==========================================
            const unnotifiedViewedApps = await Application.find({
                isViewedByClient: true,
                notifiedViewedNoPackage: false
            }).populate('customer');

            for (const app of unnotifiedViewedApps) {
                if (app.customer && !app.customer.activePlan) {
                    // Send notification
                    const messages = [
                        "You have already shortlisted candidates. Activate a hiring package to contact and hire them.",
                        "Limited-time support available. Complete your package activation today."
                    ];
                    // Rotate or pick
                    const msg = (Math.random() > 0.5) ? messages[0] : messages[1];

                    app.notifiedViewedNoPackage = true;
                    await app.save();

                    await notificationController.sendNotificationToUser({
                        userId: app.customer._id,
                        userModel: 'User',
                        title: '💼 Activate Hiring Package',
                        message: msg,
                        type: 'package_upgrade',
                        relatedId: app._id,
                        relatedModel: 'Application',
                        actionUrl: '/plans'
                    });
                }
            }

            // ==========================================
            // 4. Job Has Low Applications
            // ==========================================
            // Check jobs created > 24 hours ago that have < 3 applications
            const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
            const lowAppJobs = await Job.find({
                createdAt: { $lte: twentyFourHoursAgo },
                isActive: true,
                lowAppsReminderSent: false
            });

            for (const job of lowAppJobs) {
                const appCount = await Application.countDocuments({ job: job._id });
                if (appCount < 3) {
                    const messages = [
                        "We are expanding your search to find more suitable candidates.",
                        "Our recruitment team is actively sourcing additional profiles."
                    ];
                    const selectedMsg = (Math.random() > 0.5) ? messages[0] : messages[1];

                    job.lowAppsReminderSent = true;
                    await job.save();

                    await notificationController.sendNotificationToUser({
                        userId: job.createdBy,
                        userModel: 'User',
                        title: '🚀 Sourcing Candidates',
                        message: selectedMsg,
                        type: 'job_status',
                        relatedId: job._id,
                        relatedModel: 'Job',
                        actionUrl: '/jobs'
                    });
                }
            }

            // ==========================================
            // 7. Daily Booking Automation (₹500 Payment Reminder)
            // ==========================================
            const pendingBookings = await Booking.find({
                status: 'pending',
                paymentReminderSent: false
            });

            for (const booking of pendingBookings) {
                const diffMins = Math.floor((now - new Date(booking.createdAt)) / 60000);
                // Reminder after 30 minutes
                if (diffMins >= 30) {
                    booking.paymentReminderSent = true;
                    await booking.save();

                    await notificationController.sendNotificationToUser({
                        userId: booking.customer,
                        userModel: 'User',
                        title: '💳 Payment Pending',
                        message: "Your booking request is pending. Pay ₹500 to confirm staff availability.",
                        type: 'booking',
                        relatedId: booking._id,
                        relatedModel: 'Booking',
                        actionUrl: '/bookings'
                    });
                }
            }

        } catch (err) {
            console.error('[Scheduler 5-Min Error]:', err);
        }
    });

    // Run Daily at 9:00 AM (for subscription validity expiring & package upgrades)
    cron.schedule('0 9 * * *', async () => {
        console.log('[Scheduler] Running daily subscription & package checks...');
        const now = new Date();

        try {
            // ==========================================
            // 5. Before Validity Ends (15 Days Reminder)
            // ==========================================
            const fifteenDaysFromNowStart = new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000));
            const fifteenDaysFromNowEnd = new Date(now.getTime() + (16 * 24 * 60 * 60 * 1000));

            const expiringUsers = await User.find({
                planExpiryDate: {
                    $gte: fifteenDaysFromNowStart,
                    $lte: fifteenDaysFromNowEnd
                }
            });

            for (const user of expiringUsers) {
                await notificationController.sendNotificationToUser({
                    userId: user._id,
                    userModel: 'User',
                    title: '⏳ Plan Expiring Soon',
                    message: "Your hiring support validity expires in 15 days. Upgrade now for uninterrupted support.",
                    type: 'package_upgrade',
                    actionUrl: '/plans'
                });
            }

            // ==========================================
            // 6. Package Upgrade Automation (Upsells)
            // ==========================================
            // Fetch users with active plans to propose upgrades
            const usersWithPlans = await User.find({
                activePlan: { $ne: null }
            }).populate('activePlan');

            for (const user of usersWithPlans) {
                // If plan is expiring in 7 days, we upsell upgrades
                const diffMs = new Date(user.planExpiryDate) - now;
                const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

                if (diffDays <= 7 && diffDays > 0) {
                    const currentPlanName = user.activePlan.name.toLowerCase();
                    let title = '⚡ Upgrade Your Experience';
                    let message = '';

                    if (currentPlanName.includes('basic')) {
                        message = "Need more hiring security? Upgrade to Standard and get 4 replacements plus priority support.";
                    } else if (currentPlanName.includes('standard')) {
                        message = "Upgrade to Premium for year-long protection and dedicated account management.";
                    }

                    if (message) {
                        await notificationController.sendNotificationToUser({
                            userId: user._id,
                            userModel: 'User',
                            title,
                            message,
                            type: 'package_upgrade',
                            actionUrl: '/plans'
                        });
                    }
                }
            }

        } catch (err) {
            console.error('[Scheduler Daily Error]:', err);
        }
    });
};

module.exports = initScheduler;
