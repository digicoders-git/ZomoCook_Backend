const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars FIRST before any other imports that use process.env
dotenv.config();

const connectDB = require('./config/db');
const Application = require('./models/Application');

// Connect to database
connectDB();

// Initialize notification scheduler
const initScheduler = require('./config/scheduler');
initScheduler();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    const allowed = [
      'https://zomo-cook-admin-panel.vercel.app',
      'https://yourdomain.com',              // Production frontend
      'https://www.yourdomain.com',
      'http://localhost:5173',        // Vite dev server
      'http://localhost:3000',        // React dev server
      'http://localhost:3001',        // Alternative port
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000',
      /^http:\/\/localhost:\d+$/,
      /^http:\/\/127\.0\.0\.1:\d+$/,
    ];
    const isAllowed = allowed.some(p =>
      typeof p === 'string' ? p === origin : p.test(origin)
    );
    callback(isAllowed ? null : new Error('CORS blocked'), isAllowed);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const fs = require('fs');

const handleStaticFiles = (req, res, next) => {
  const decodedPath = decodeURIComponent(req.path);
  const filePath = path.join(__dirname, 'uploads', decodedPath);
  
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }
  
  // Fallback if the requested file is missing (e.g. Render server restarted)
  if (decodedPath.includes('candidate-') || decodedPath.includes('cv') || decodedPath.includes('resume')) {
    const ext = path.extname(decodedPath).toLowerCase();
    if (ext === '.pdf') {
      const pdfPath = path.join(__dirname, 'uploads', 'default-resume.pdf');
      if (fs.existsSync(pdfPath)) {
        return res.sendFile(pdfPath);
      }
    } else if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
      const imgPath = path.join(__dirname, 'uploads', 'default-resume.png');
      if (fs.existsSync(imgPath)) {
        return res.sendFile(imgPath);
      }
    }
  }
  next();
};

app.use('/api/uploads', handleStaticFiles, express.static('uploads'));
app.use('/uploads', handleStaticFiles, express.static('uploads'));

// Routes
app.use('/api/admin/users', require('./routes/userRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api', require('./routes/candidateVerificationRoutes'));
app.use('/api/customers', require('./routes/customerRoutes'));
app.use('/api/jobs', require('./routes/jobRoutes'));
app.use('/api/candidates', require('./routes/candidateRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/queries', require('./routes/queryRoutes'));
app.use('/api/roles', require('./routes/roleRoutes'));
app.use('/api/masters', require('./routes/masterRoutes'));
app.use('/api/settings', require('./routes/webSettingRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/finance', require('./routes/financeRoutes'));
app.use('/api/banners', require('./routes/bannerRoutes'));
app.use('/api/applications', require('./routes/applicationRoutes'));
app.use('/api/bookings', require('./routes/bookingRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/plans', require('./routes/planRoutes'));
app.use('/api/subscriptions', require('./routes/subscriptionRoutes'));
app.use('/api/offers', require('./routes/offerRoutes'));
app.use('/api/chats', require('./routes/messageRoutes'));
app.use('/api/replacements', require('./routes/replacementRoutes'));
app.get('/', (req, res) => {
  res.send('ZomoCook API is running...');
});

// ── DEV/TEST: Manually trigger scheduler ──────────────────────────────────────
app.get('/api/test/run-scheduler', async (req, res) => {
  try {
    const Job = require('./models/Job');
    const Application = require('./models/Application');
    const Booking = require('./models/Booking');
    const User = require('./models/User');
    const notificationController = require('./controllers/notificationController');
    const now = new Date();
    const results = [];

    // 1. Inactive Jobs
    const pendingJobs = await Job.find({ $or: [{ status: 'Inactive' }, { isActive: false }] });
    for (const job of pendingJobs) {
      const diffMins = Math.floor((now - new Date(job.createdAt)) / 60000);
      const diffHours = Math.floor(diffMins / 60);
      let message = '';
      let updated = false;
      if (diffHours >= 24 && !job.paymentReminderSent24Hour) {
        message = 'Your job is still inactive. Activate now before candidates become unavailable.';
        job.paymentReminderSent24Hour = true; updated = true;
      } else if (diffHours >= 6 && !job.paymentReminderSent6Hour) {
        message = "Don't miss qualified candidates. Complete your hiring process today.";
        job.paymentReminderSent6Hour = true; updated = true;
      } else if (diffMins >= 60 && !job.paymentReminderSent1Hour) {
        message = 'Good news! Cooks are available. Activate your job now.';
        job.paymentReminderSent1Hour = true; updated = true;
      } else if (diffMins >= 15 && !job.paymentReminderSent15Min) {
        message = 'Your job is now live. 3 cooks have already shown interest.';
        job.paymentReminderSent15Min = true; updated = true;
      }
      if (updated && message) {
        await job.save();
        await notificationController.sendNotificationToUser({ userId: job.createdBy, userModel: 'User', title: '⚠️ Job Activation Required', message, type: 'job_status', relatedId: job._id, relatedModel: 'Job', actionUrl: '/jobs' });
        results.push({ trigger: 'job_inactive', jobId: job._id, message });
      }
    }

    // 2. Unviewed Applications
    const activeJobs = await Job.find({ isActive: true });
    for (const job of activeJobs) {
      const unviewed = await Application.find({ job: job._id, status: 'Applied', isViewedByClient: false, notifiedAppliedNotViewed: false });
      if (unviewed.length > 0) {
        const msg = unviewed.length >= 3 ? `${unviewed.length} verified candidates are waiting. Review profiles now.` : 'Your next chef could be one click away. View shortlisted candidates.';
        await Application.updateMany({ _id: { $in: unviewed.map(a => a._id) } }, { $set: { notifiedAppliedNotViewed: true } });
        await notificationController.sendNotificationToUser({ userId: job.createdBy, userModel: 'User', title: '📝 Candidates Waiting', message: msg, type: 'application_status', relatedId: job._id, relatedModel: 'Job', actionUrl: '/applications' });
        results.push({ trigger: 'unviewed_applications', jobId: job._id, count: unviewed.length });
      }
    }

    // 4. Low Applications
    const lowAppJobs = await Job.find({ isActive: true, lowAppsReminderSent: false });
    for (const job of lowAppJobs) {
      const appCount = await Application.countDocuments({ job: job._id });
      if (appCount < 3) {
        const msg = 'We are expanding your search to find more suitable candidates.';
        job.lowAppsReminderSent = true;
        await job.save();
        await notificationController.sendNotificationToUser({ userId: job.createdBy, userModel: 'User', title: '🚀 Sourcing Candidates', message: msg, type: 'job_status', relatedId: job._id, relatedModel: 'Job', actionUrl: '/jobs' });
        results.push({ trigger: 'low_applications', jobId: job._id, appCount });
      }
    }

    // 7. Pending Bookings
    const pendingBookings = await Booking.find({ status: 'pending', paymentReminderSent: false });
    for (const booking of pendingBookings) {
      booking.paymentReminderSent = true;
      await booking.save();
      await notificationController.sendNotificationToUser({ userId: booking.customer, userModel: 'User', title: '💳 Payment Pending', message: 'Your booking request is pending. Pay ₹500 to confirm staff availability.', type: 'booking', relatedId: booking._id, relatedModel: 'Booking', actionUrl: '/bookings' });
      results.push({ trigger: 'pending_booking', bookingId: booking._id });
    }

    res.json({ success: true, message: 'Scheduler ran successfully', triggered: results.length, results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Test: Send notification to a specific user by phone
app.post('/api/test/send-notification', async (req, res) => {
  try {
    const { phone, title, message, actionUrl } = req.body;
    const User = require('./models/User');
    const user = await User.findOne({ phone: new RegExp(phone + '$') });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const notificationController = require('./controllers/notificationController');
    await notificationController.sendNotificationToUser({
      userId: user._id,
      userModel: 'User',
      title: title || 'Test Notification',
      message: message || 'Yeh ek test notification hai',
      type: 'system',
      actionUrl: actionUrl || '/'
    });
    res.json({ success: true, message: `Notification sent to ${user.name} (${phone})`, fcmToken: user.fcmToken ? 'present' : 'missing' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Test: List all live users and their FCM token presence
app.get('/api/test/list-users', async (req, res) => {
  try {
    const User = require('./models/User');
    const users = await User.find({}).select('phone fcmToken name');
    res.json({
      version: "v1.3-key-check",
      success: true,
      count: users.length,
      users: users.map(u => ({
        name: u.name,
        phone: u.phone,
        hasFcmToken: !!u.fcmToken,
        fcmToken: u.fcmToken ? (u.fcmToken.substring(0, 15) + '...') : null
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Test: Check the format of the FIREBASE_PRIVATE_KEY environment variable on the server
app.get('/api/test/check-key', (req, res) => {
  const key = process.env.FIREBASE_PRIVATE_KEY;
  if (!key) return res.json({ status: "Missing key" });
  res.json({
    length: key.length,
    startsWithQuote: key.startsWith('"') || key.startsWith("'"),
    endsWithQuote: key.endsWith('"') || key.endsWith("'"),
    startsWithBegin: key.includes("-----BEGIN PRIVATE KEY-----"),
    endsWithEnd: key.includes("-----END PRIVATE KEY-----"),
    newlineCount: (key.match(/\n/g) || []).length,
    escapedNewlineCount: (key.match(/\\n/g) || []).length,
    first50: key.substring(0, 50),
    last50: key.substring(key.length - 50)
  });
});

// Error handling middleware (optional but good practice)
app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode);
  res.json({
    success: false,
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});

app.listen(PORT, () => {
  console.log(`Server is running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
