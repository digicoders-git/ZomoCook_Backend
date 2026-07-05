const request = require('supertest');
const mongoose = require('mongoose');
const Application = require('../models/Application');
const ServicePackagePayment = require('../models/ServicePackagePayment');
const ServicePackage = require('../models/ServicePackage');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const Candidate = require('../models/Candidate');
const Job = require('../models/Job');

describe('Payment Controller - Service Package', () => {
  let app;
  let customerId;
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
    await Transaction.deleteMany({});
    await User.deleteMany({});
    await Candidate.deleteMany({});
    await Job.deleteMany({});

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

    const job = await Job.create({
      title: 'Chef',
      jobCategory: 'hotel',
      overview: 'Test',
      responsibilities: 'Cooking',
      requirements: 'Experience',
      customer: customerId,
      city: 'Mumbai',
      state: 'Maharashtra',
      jobType: 'Full Time',
      jobPosition: 'Chef',
    });

    const application = await Application.create({
      job: job._id,
      candidate: candidate._id,
      customer: customerId,
      status: 'Package Selected',
      servicePackage: 'Standard',
    });
    applicationId = application._id;

    await ServicePackage.create({
      name: 'Basic',
      price: 499,
      replacementLimit: 1,
      demoLimit: 1,
      features: ['1 replacement'],
    });

    await ServicePackage.create({
      name: 'Standard',
      price: 999,
      replacementLimit: 2,
      demoLimit: 2,
      features: ['2 replacements'],
    });

    await ServicePackage.create({
      name: 'Premium',
      price: 1999,
      replacementLimit: 5,
      demoLimit: 5,
      features: ['5 replacements'],
    });

    token = 'test_token';
  });

  describe('GET SERVICE PACKAGES', () => {
    test('Should return all active service packages', async () => {
      const response = await request(app)
        .get('/api/payments/service-packages')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.packages.length).toBe(3);
      expect(response.body.packages[0].name).toBe('Basic');
      expect(response.body.packages[0].price).toBe(499);
    });

    test('Should return packages sorted by price', async () => {
      const response = await request(app)
        .get('/api/payments/service-packages')
        .set('Authorization', `Bearer ${token}`);

      expect(response.body.packages[0].price).toBeLessThan(response.body.packages[1].price);
      expect(response.body.packages[1].price).toBeLessThan(response.body.packages[2].price);
    });

    test('Should only return active packages', async () => {
      await ServicePackage.findOneAndUpdate(
        { name: 'Premium' },
        { isActive: false }
      );

      const response = await request(app)
        .get('/api/payments/service-packages')
        .set('Authorization', `Bearer ${token}`);

      expect(response.body.packages.length).toBe(2);
      expect(response.body.packages.every(p => p.isActive)).toBe(true);
    });
  });

  describe('CREATE PAYMENT ORDER', () => {
    test('Should create payment order for service package', async () => {
      const response = await request(app)
        .post('/api/payments/create-order')
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 999,
          currency: 'INR',
          type: 'service_package',
          applicationId: applicationId.toString(),
          packageType: 'Standard',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.order).toBeDefined();
      expect(response.body.order.amount).toBe(99900);
      expect(response.body.transactionId).toBeDefined();
    });

    test('Should create transaction record', async () => {
      const response = await request(app)
        .post('/api/payments/create-order')
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 999,
          currency: 'INR',
          type: 'service_package',
          applicationId: applicationId.toString(),
          packageType: 'Standard',
        });

      const transaction = await Transaction.findById(response.body.transactionId);
      expect(transaction).toBeDefined();
      expect(transaction.type).toBe('service_package');
      expect(transaction.amount).toBe(999);
      expect(transaction.status).toBe('pending');
    });

    test('Should require amount for order creation', async () => {
      const response = await request(app)
        .post('/api/payments/create-order')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currency: 'INR',
          type: 'service_package',
          applicationId: applicationId.toString(),
          packageType: 'Standard',
        });

      expect(response.status).toBe(500);
    });
  });

  describe('VERIFY PAYMENT', () => {
    test('Should verify payment and update application', async () => {
      const orderResponse = await request(app)
        .post('/api/payments/create-order')
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 999,
          currency: 'INR',
          type: 'service_package',
          applicationId: applicationId.toString(),
          packageType: 'Standard',
        });

      const orderId = orderResponse.body.order.id;
      const paymentId = 'pay_test_123';
      const signature = 'test_signature';

      const verifyResponse = await request(app)
        .post('/api/payments/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature,
          type: 'service_package',
          applicationId: applicationId.toString(),
          packageType: 'Standard',
        });

      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.body.success).toBe(true);
    });

    test('Should create ServicePackagePayment record', async () => {
      const orderResponse = await request(app)
        .post('/api/payments/create-order')
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 999,
          currency: 'INR',
          type: 'service_package',
          applicationId: applicationId.toString(),
          packageType: 'Standard',
        });

      const orderId = orderResponse.body.order.id;

      await request(app)
        .post('/api/payments/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({
          razorpay_order_id: orderId,
          razorpay_payment_id: 'pay_test_123',
          razorpay_signature: 'test_signature',
          type: 'service_package',
          applicationId: applicationId.toString(),
          packageType: 'Standard',
        });

      const payment = await ServicePackagePayment.findOne({
        application: applicationId,
      });

      expect(payment).toBeDefined();
      expect(payment.packageType).toBe('Standard');
      expect(payment.amount).toBe(999);
      expect(payment.status).toBe('paid');
      expect(payment.replacementLimit).toBe(2);
    });

    test('Should update application status to Package Paid', async () => {
      const orderResponse = await request(app)
        .post('/api/payments/create-order')
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 999,
          currency: 'INR',
          type: 'service_package',
          applicationId: applicationId.toString(),
          packageType: 'Standard',
        });

      const orderId = orderResponse.body.order.id;

      await request(app)
        .post('/api/payments/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({
          razorpay_order_id: orderId,
          razorpay_payment_id: 'pay_test_123',
          razorpay_signature: 'test_signature',
          type: 'service_package',
          applicationId: applicationId.toString(),
          packageType: 'Standard',
        });

      const application = await Application.findById(applicationId);
      expect(application.status).toBe('Package Paid');
      expect(application.servicePackagePaid).toBe(true);
      expect(application.servicePackagePaymentId).toBeDefined();
    });

    test('Should reject invalid signature', async () => {
      const orderResponse = await request(app)
        .post('/api/payments/create-order')
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 999,
          currency: 'INR',
          type: 'service_package',
          applicationId: applicationId.toString(),
          packageType: 'Standard',
        });

      const orderId = orderResponse.body.order.id;

      const verifyResponse = await request(app)
        .post('/api/payments/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({
          razorpay_order_id: orderId,
          razorpay_payment_id: 'pay_test_123',
          razorpay_signature: 'invalid_signature',
          type: 'service_package',
          applicationId: applicationId.toString(),
          packageType: 'Standard',
        });

      expect(verifyResponse.status).toBe(400);
      expect(verifyResponse.body.success).toBe(false);
    });

    test('Should handle non-existent application', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const orderResponse = await request(app)
        .post('/api/payments/create-order')
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 999,
          currency: 'INR',
          type: 'service_package',
          applicationId: fakeId.toString(),
          packageType: 'Standard',
        });

      const orderId = orderResponse.body.order.id;

      const verifyResponse = await request(app)
        .post('/api/payments/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({
          razorpay_order_id: orderId,
          razorpay_payment_id: 'pay_test_123',
          razorpay_signature: 'test_signature',
          type: 'service_package',
          applicationId: fakeId.toString(),
          packageType: 'Standard',
        });

      expect(verifyResponse.status).toBe(404);
      expect(verifyResponse.body.message).toContain('Application not found');
    });
  });

  describe('PAYMENT FLOW INTEGRATION', () => {
    test('Complete payment flow: order -> verify -> demo scheduling', async () => {
      // Step 1: Create order
      const orderResponse = await request(app)
        .post('/api/payments/create-order')
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 999,
          currency: 'INR',
          type: 'service_package',
          applicationId: applicationId.toString(),
          packageType: 'Standard',
        });

      expect(orderResponse.status).toBe(200);
      const orderId = orderResponse.body.order.id;

      // Step 2: Verify payment
      const verifyResponse = await request(app)
        .post('/api/payments/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({
          razorpay_order_id: orderId,
          razorpay_payment_id: 'pay_test_123',
          razorpay_signature: 'test_signature',
          type: 'service_package',
          applicationId: applicationId.toString(),
          packageType: 'Standard',
        });

      expect(verifyResponse.status).toBe(200);

      // Step 3: Verify application is updated
      const application = await Application.findById(applicationId);
      expect(application.servicePackagePaid).toBe(true);
      expect(application.status).toBe('Package Paid');

      // Step 4: Now demo scheduling should be allowed
      const demoResponse = await request(app)
        .post(`/api/applications/${applicationId}/schedule-demo`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          demoDate: '2024-02-01',
          demoTime: '14:00',
        });

      expect(demoResponse.status).toBe(200);
      expect(demoResponse.body.application.status).toBe('Demo Scheduled');
    });
  });
});
