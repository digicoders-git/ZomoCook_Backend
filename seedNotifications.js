const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Notification = require('./models/Notification');
const connectDB = require('./config/db');

dotenv.config();
connectDB();

const seedNotifications = async () => {
  try {
    // Clear existing notifications
    await Notification.deleteMany({});

    const notifications = [
      {
        title: '✨ New Job Available',
        message: 'A new home cooking job is available in your area. Apply now to secure the opportunity!',
        target: 'candidates',
        status: 'active'
      },
      {
        title: '🎉 Application Approved',
        message: 'Congratulations! Your application has been shortlisted. Schedule your demo with the customer.',
        target: 'candidates',
        status: 'active'
      },
      {
        title: '📅 Demo Scheduled',
        message: 'Your demo is scheduled for tomorrow at 10:00 AM. Don\'t forget to join the meeting link!',
        target: 'candidates',
        status: 'active'
      },
      {
        title: '🎊 Hired Successfully',
        message: 'Great news! You have been hired. Check your bookings tab to view the details.',
        target: 'candidates',
        status: 'active'
      },
      {
        title: '💼 New Cook Available',
        message: 'A verified cook with 5+ years of experience is available in your city.',
        target: 'customers',
        status: 'active'
      },
      {
        title: '✅ Booking Confirmed',
        message: 'Your booking with Chef Rahul is confirmed for tomorrow. Meeting link has been sent.',
        target: 'customers',
        status: 'active'
      },
      {
        title: '⭐ Rating Received',
        message: 'You received a 5-star rating from a customer! Keep up the good work.',
        target: 'candidates',
        status: 'active'
      },
      {
        title: '🔔 System Update',
        message: 'ZomoCook has been updated with new features. Check the app for improvements!',
        target: 'all',
        status: 'active'
      },
      {
        title: '📢 Special Offer',
        message: 'Get 20% discount on your next booking. Use code COOK20 at checkout.',
        target: 'all',
        status: 'active'
      },
      {
        title: '⚠️ Profile Verification Pending',
        message: 'Please complete your profile verification to unlock all features.',
        target: 'candidates',
        status: 'active'
      }
    ];

    const created = await Notification.insertMany(notifications);
    console.log(`✅ ${created.length} notifications seeded successfully!`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding notifications:', error);
    process.exit(1);
  }
};

seedNotifications();
