const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const Application = require('./models/Application');

// Load env vars
dotenv.config();

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
app.use('/api/uploads', express.static('uploads'));
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/admin/users', require('./routes/userRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/customers', require('./routes/customerRoutes'));
app.use('/api/jobs', require('./routes/jobRoutes'));
app.use('/api/candidates', require('./routes/candidateRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/queries', require('./routes/queryRoutes'));
app.use('/api/roles', require('./routes/roleRoutes'));
app.use('/api/masters', require('./routes/masterRoutes'));
app.use('/api/settings', require('./routes/webSettingRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/banners', require('./routes/bannerRoutes'));
app.use('/api/applications', require('./routes/applicationRoutes'));
app.use('/api/bookings', require('./routes/bookingRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/plans', require('./routes/planRoutes'));
app.use('/api/subscriptions', require('./routes/subscriptionRoutes'));
app.use('/api/offers', require('./routes/offerRoutes'));
app.use('/api/chats', require('./routes/messageRoutes'));

app.get('/', (req, res) => {
  res.send('ZomoCook API is running...');
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
