const request = require('supertest');
const mongoose = require('mongoose');
const Application = require('../models/Application');
const ServicePackagePayment = require('../models/ServicePackagePayment');
const ServicePackage = require('../models/ServicePackage');
const Job = require('../models/Job');
const Candidate = require('../models/Candidate');
const User = require('../models/User');

describe('Application Controller - Service Package Flow', () => {
  let app;
  let applicationId;
  let jobId;
  let candidateId;
  let customerId;
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

    const customer = await User.create({
      name: 'Test Customer',
      email: 'customer@test.com',
      phone: '9876543210',
      role: 'customer',
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

  describe('SELECT SERVICE PACKAGE', () => {
    test('Should select service package successfully', async () => {
      const response = await request(app)
        .post(`/api/applications/${applicationId}/select-package`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          packageType: 'Standard',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.application.servicePackage).toBe('Standard');
      expect(response.body.application.status).toBe('Package Selected');
    });

    test('Should reject invalid package type', async () => {
      const response = await request(app)
        .post(`/api/applications/${applicationId}/select-package`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          packageType: 'InvalidPackage',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('Should return 404 for non-existent application', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/applications/${fakeId}/select-package`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          packageType: 'Standard',
        });

      expect(response.status).toBe(404);
    });
  });

  describe('SCHEDULE DEMO - PAYMENT VALIDATION', () => {
    test('Should block demo scheduling without payment', async () => {
      await request(app)
        .post(`/api/applications/${applicationId}/select-package`)
        .set('Authorization', `Bearer ${token}`)
        .send({ packageType: 'Standard' });

      const response = await request(app)
        .post(`/api/applications/${applicationId}/schedule-demo`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          demoDate: '2024-02-01',
          demoTime: '14:00',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Service package payment is required');
      expect(response.body.requiresPayment).toBe(true);
    });

    test('Should allow demo scheduling after payment', async () => {
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
        status: 'paid',
      });

      await Application.findByIdAndUpdate(applicationId, {
        servicePackagePaymentId: payment._id,
        servicePackagePaid: true,
        status: 'Package Paid',
      });

      const response = await request(app)
        .post(`/api/applications/${applicationId}/schedule-demo`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          demoDate: '2024-02-01',
          demoTime: '14:00',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.application.status).toBe('Demo Scheduled');
      expect(response.body.application.demoDate).toBe('2024-02-01');
    });

    test('Should require date and time for demo scheduling', async () => {
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

      const response = await request(app)
        .post(`/api/applications/${applicationId}/schedule-demo`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Demo date and time are required');
    });
  });

  describe('REJECT APPLICATION - REPLACEMENT TRACKING', () => {
    test('Should track replacement usage', async () => {
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
      });

      const response = await request(app)
        .post(`/api/applications/${applicationId}/reject`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          rejectionReason: 'Not suitable',
        });

      expect(response.status).toBe(200);
      expect(response.body.replacementInfo.replacementsUsed).toBe(1);
      expect(response.body.replacementInfo.canReplace).toBe(true);
    });

    test('Should enforce replacement limit', async () => {
      const payment = await ServicePackagePayment.create({
        application: applicationId,
        customer: customerId,
        packageType: 'Basic',
        amount: 499,
        replacementLimit: 1,
        replacementsUsed: 1,
        status: 'paid',
      });

      await Application.findByIdAndUpdate(applicationId, {
        servicePackagePaymentId: payment._id,
        servicePackagePaid: true,
      });

      const response = await request(app)
        .post(`/api/applications/${applicationId}/reject`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          rejectionReason: 'Not suitable',
        });

      expect(response.status).toBe(200);
      expect(response.body.replacementInfo.canReplace).toBe(false);
      expect(response.body.replacementInfo.replacementsUsed).toBe(1);
      expect(response.body.replacementInfo.replacementLimit).toBe(1);
    });
  });

  describe('HIRE COOK', () => {
    test('Should hire cook successfully', async () => {
      const response = await request(app)
        .post(`/api/applications/${applicationId}/hire`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          joiningDate: '2024-02-01',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.application.status).toBe('Hired');
      expect(response.body.booking).toBeDefined();
    });

    test('Should require joining date', async () => {
      const response = await request(app)
        .post(`/api/applications/${applicationId}/hire`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Joining date is required');
    });
  });

  describe('UPDATE APPLICATION STATUS', () => {
    test('Should update status to Profile Reviewed', async () => {
      const response = await request(app)
        .patch(`/api/applications/${applicationId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          status: 'Profile Reviewed',
        });

      expect(response.status).toBe(200);
      expect(response.body.application.status).toBe('Profile Reviewed');
    });

    test('Should reject invalid status', async () => {
      const response = await request(app)
        .patch(`/api/applications/${applicationId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          status: 'InvalidStatus',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid status');
    });
  });

  describe('GET APPLICATION BY ID', () => {
    test('Should return application details', async () => {
      const response = await request(app)
        .get(`/api/applications/${applicationId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.application._id).toBe(applicationId.toString());
    });

    test('Should return 404 for non-existent application', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/applications/${fakeId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
    });
  });
});
