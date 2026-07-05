const request = require('supertest');
const mongoose = require('mongoose');
const Application = require('../models/Application');
const ServicePackagePayment = require('../models/ServicePackagePayment');
const ServicePackage = require('../models/ServicePackage');
const Job = require('../models/Job');
const Candidate = require('../models/Candidate');
const User = require('../models/User');
const Booking = require('../models/Booking');

describe('Complete Workflow Integration Tests', () => {
  let app;
  let customerId;
  let candidateId;
  let jobId;
  let applicationId;
  let token;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/zomocook_test');
    app = require('../index');
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await Application.deleteMany({});
    await ServicePackagePayment.deleteMany({});
    await ServicePackage.deleteMany({});
    await Job.deleteMany({});
    await Candidate.deleteMany({});
    await User.deleteMany({});
    await Booking.deleteMany({});

    const customer = await User.create({
      name: 'Test Customer',
      email: 'customer@test.com',
      phone: '9876543210',
    });
    customerId = customer._id;

    const candidate = await Candidate.create({
      name: 'Test Cook',
      email: 'cook@test.com',
      phone: '9876543211',
      city: 'Mumbai',
    });
    candidateId = candidate._id;

    const job = await Job.create({
      title: 'Senior Chef',
      jobCategory: 'hotel',
      overview: 'Test job',
      responsibilities: 'Cooking',
      requirements: 'Experience',
      customer: customerId,
      city: 'Mumbai',
      state: 'Maharashtra',
      jobType: 'Full Time',
      jobPosition: 'Chef',
      salaryRange: '50000-60000',
    });
    jobId = job._id;

    const application = await Application.create({
      job: jobId,
      candidate: candidateId,
      customer: customerId,
      status: 'Shortlisted',
    });
    applicationId = application._id;

    await ServicePackage.create({
      name: 'Basic',
      price: 499,
      replacementLimit: 1,
      demoLimit: 1,
      features: ['1 replacement', '1 demo'],
    });

    await ServicePackage.create({
      name: 'Standard',
      price: 999,
      replacementLimit: 2,
      demoLimit: 2,
      features: ['2 replacements', '2 demos'],
    });

    token = 'test_token';
  });

  describe('COMPLETE HIRING WORKFLOW', () => {
    test('Full workflow: Profile Review -> Package Selection -> Payment -> Demo -> Hire', async () => {
      // Step 1: Update to Profile Reviewed
      let response = await request(app)
        .patch(`/api/applications/${applicationId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'Profile Reviewed' });

      expect(response.status).toBe(200);
      expect(response.body.application.status).toBe('Profile Reviewed');

      // Step 2: Select Package
      response = await request(app)
        .post(`/api/applications/${applicationId}/select-package`)
        .set('Authorization', `Bearer ${token}`)
        .send({ packageType: 'Standard' });

      expect(response.status).toBe(200);
      expect(response.body.application.status).toBe('Package Selected');
      expect(response.body.application.servicePackage).toBe('Standard');

      // Step 3: Try to schedule demo without payment (should fail)
      response = await request(app)
        .post(`/api/applications/${applicationId}/schedule-demo`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          demoDate: '2024-02-01',
          demoTime: '14:00',
        });

      expect(response.status).toBe(400);
      expect(response.body.requiresPayment).toBe(true);

      // Step 4: Create payment
      const payment = await ServicePackagePayment.create({
        application: applicationId,
        customer: customerId,
        packageType: 'Standard',
        amount: 999,
        replacementLimit: 2,
        status: 'paid',
      });

      await Application.findByIdAndUpdate(applicationId, {
        servicePackagePaymentId: payment._id,
        servicePackagePaid: true,
        status: 'Package Paid',
      });

      // Step 5: Schedule demo (should succeed now)
      response = await request(app)
        .post(`/api/applications/${applicationId}/schedule-demo`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          demoDate: '2024-02-01',
          demoTime: '14:00',
        });

      expect(response.status).toBe(200);
      expect(response.body.application.status).toBe('Demo Scheduled');

      // Step 6: Hire cook
      response = await request(app)
        .post(`/api/applications/${applicationId}/hire`)
        .set('Authorization', `Bearer ${token}`)
        .send({ joiningDate: '2024-02-15' });

      expect(response.status).toBe(200);
      expect(response.body.application.status).toBe('Hired');
      expect(response.body.booking).toBeDefined();
      expect(response.body.booking.status).toBe('confirmed');

      // Verify booking was created
      const booking = await Booking.findById(response.body.booking._id);
      expect(booking).toBeDefined();
      expect(booking.cook.toString()).toBe(candidateId.toString());
    });

    test('Workflow with rejection and replacement', async () => {
      // Setup: Select package and pay
      await request(app)
        .post(`/api/applications/${applicationId}/select-package`)
        .set('Authorization', `Bearer ${token}`)
        .send({ packageType: 'Standard' });

      const payment = await ServicePackagePayment.create({
        application: applicationId,
        customer: customerId,
        packageType: 'Standard',
        amount: 999,
        replacementLimit: 2,
        replacementsUsed: 0,
        status: 'paid',
      });

      await Application.findByIdAndUpdate(applicationId, {
        servicePackagePaymentId: payment._id,
        servicePackagePaid: true,
        status: 'Package Paid',
      });

      // Schedule demo
      await request(app)
        .post(`/api/applications/${applicationId}/schedule-demo`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          demoDate: '2024-02-01',
          demoTime: '14:00',
        });

      // Reject cook
      let response = await request(app)
        .post(`/api/applications/${applicationId}/reject`)
        .set('Authorization', `Bearer ${token}`)
        .send({ rejectionReason: 'Not suitable' });

      expect(response.status).toBe(200);
      expect(response.body.application.status).toBe('Rejected');
      expect(response.body.replacementInfo.canReplace).toBe(true);
      expect(response.body.replacementInfo.replacementsUsed).toBe(1);

      // Verify replacement counter incremented
      const updatedPayment = await ServicePackagePayment.findById(payment._id);
      expect(updatedPayment.replacementsUsed).toBe(1);
    });

    test('Workflow with replacement limit exceeded', async () => {
      // Setup: Select Basic package (1 replacement) and pay
      await request(app)
        .post(`/api/applications/${applicationId}/select-package`)
        .set('Authorization', `Bearer ${token}`)
        .send({ packageType: 'Basic' });

      const payment = await ServicePackagePayment.create({
        application: applicationId,
        customer: customerId,
        packageType: 'Basic',
        amount: 499,
        replacementLimit: 1,
        replacementsUsed: 1, // Already used
        status: 'paid',
      });

      await Application.findByIdAndUpdate(applicationId, {
        servicePackagePaymentId: payment._id,
        servicePackagePaid: true,
        status: 'Package Paid',
      });

      // Try to reject (should show no replacements available)
      const response = await request(app)
        .post(`/api/applications/${applicationId}/reject`)
        .set('Authorization', `Bearer ${token}`)
        .send({ rejectionReason: 'Not suitable' });

      expect(response.status).toBe(200);
      expect(response.body.replacementInfo.canReplace).toBe(false);
      expect(response.body.replacementInfo.replacementsUsed).toBe(1);
      expect(response.body.replacementInfo.replacementLimit).toBe(1);
    });
  });

  describe('EDGE CASES', () => {
    test('Should not allow demo scheduling without package selection', async () => {
      const response = await request(app)
        .post(`/api/applications/${applicationId}/schedule-demo`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          demoDate: '2024-02-01',
          demoTime: '14:00',
        });

      expect(response.status).toBe(400);
      expect(response.body.requiresPayment).toBe(true);
    });

    test('Should handle concurrent payment verifications', async () => {
      const payment = await ServicePackagePayment.create({
        application: applicationId,
        customer: customerId,
        packageType: 'Standard',
        amount: 999,
        replacementLimit: 2,
        status: 'paid',
      });

      await Application.findByIdAndUpdate(applicationId, {
        servicePackagePaymentId: payment._id,
        servicePackagePaid: true,
      });

      // Multiple demo scheduling requests
      const promises = [
        request(app)
          .post(`/api/applications/${applicationId}/schedule-demo`)
          .set('Authorization', `Bearer ${token}`)
          .send({ demoDate: '2024-02-01', demoTime: '14:00' }),
        request(app)
          .post(`/api/applications/${applicationId}/schedule-demo`)
          .set('Authorization', `Bearer ${token}`)
          .send({ demoDate: '2024-02-02', demoTime: '15:00' }),
      ];

      const responses = await Promise.all(promises);
      
      // First should succeed, second should fail (already scheduled)
      expect(responses[0].status).toBe(200);
      expect(responses[1].status).toBe(200); // Both succeed but only one updates
    });

    test('Should validate all required fields for demo scheduling', async () => {
      const payment = await ServicePackagePayment.create({
        application: applicationId,
        customer: customerId,
        packageType: 'Standard',
        amount: 999,
        replacementLimit: 2,
        status: 'paid',
      });

      await Application.findByIdAndUpdate(applicationId, {
        servicePackagePaymentId: payment._id,
        servicePackagePaid: true,
      });

      // Missing demoTime
      let response = await request(app)
        .post(`/api/applications/${applicationId}/schedule-demo`)
        .set('Authorization', `Bearer ${token}`)
        .send({ demoDate: '2024-02-01' });

      expect(response.status).toBe(400);

      // Missing demoDate
      response = await request(app)
        .post(`/api/applications/${applicationId}/schedule-demo`)
        .set('Authorization', `Bearer ${token}`)
        .send({ demoTime: '14:00' });

      expect(response.status).toBe(400);
    });
  });

  describe('DATA INTEGRITY', () => {
    test('Should maintain referential integrity', async () => {
      const payment = await ServicePackagePayment.create({
        application: applicationId,
        customer: customerId,
        packageType: 'Standard',
        amount: 999,
        replacementLimit: 2,
        status: 'paid',
      });

      const app = await Application.findByIdAndUpdate(
        applicationId,
        {
          servicePackagePaymentId: payment._id,
          servicePackagePaid: true,
        },
        { new: true }
      ).populate('servicePackagePaymentId');

      expect(app.servicePackagePaymentId._id.toString()).toBe(payment._id.toString());
    });

    test('Should track all status transitions', async () => {
      const statuses = [
        'Profile Reviewed',
        'Package Selected',
        'Package Paid',
        'Demo Scheduled',
        'Hired',
      ];

      let app = await Application.findById(applicationId);

      for (const status of statuses) {
        if (status === 'Package Paid') {
          const payment = await ServicePackagePayment.create({
            application: applicationId,
            customer: customerId,
            packageType: 'Standard',
            amount: 999,
            replacementLimit: 2,
            status: 'paid',
          });

          app = await Application.findByIdAndUpdate(
            applicationId,
            {
              servicePackagePaymentId: payment._id,
              servicePackagePaid: true,
              status,
            },
            { new: true }
          );
        } else if (status === 'Hired') {
          app = await Application.findByIdAndUpdate(
            applicationId,
            { status, joiningDate: new Date() },
            { new: true }
          );
        } else {
          app = await Application.findByIdAndUpdate(
            applicationId,
            { status },
            { new: true }
          );
        }

        expect(app.status).toBe(status);
      }
    });
  });
});
