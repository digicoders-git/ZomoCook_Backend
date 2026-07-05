# ZomoCook Improved Hiring Workflow

## Overview
This document describes the new hiring workflow that prevents customers from bypassing the platform by requiring service package payment before demo scheduling.

## Workflow Steps

### 1. Customer Posts Job
- Customer posts a job on ZomoCook
- Pays ₹299 registration fee
- Admin reviews and approves the job
- Job goes live on Cook App

### 2. Cooks Apply
- Cooks browse and apply for jobs
- Admin screens and shortlists candidates
- Admin assigns cook profile(s) to customer

### 3. Customer Reviews Profile
- Customer views cook profile with:
  - Profile information
  - Experience details
  - Salary expectations
  - Masked calling (to prevent direct deals)

### 4. Customer Selects Preferred Cook
- Customer selects the cook they want to proceed with
- Application status: `Profile Reviewed`

### 5. Service Package Selection (NEW)
- Customer must select a service package:
  - **Basic**: ₹499 (1 replacement, 1 demo)
  - **Standard**: ₹999 (2 replacements, 2 demos)
  - **Premium**: ₹1999 (5 replacements, 5 demos)
- Application status: `Package Selected`

### 6. Service Package Payment (NEW)
- Customer pays for the selected package
- Payment processed via Razorpay
- Application status: `Package Paid`
- **KEY POINT**: Demo can ONLY be scheduled after this payment

### 7. Demo/Trial Scheduling (PROTECTED)
- Customer can now schedule demo/trial
- Demo date and time are set
- Cook receives notification
- Application status: `Demo Scheduled`

### 8. Demo Conducted
- Demo happens between customer and cook
- Both parties evaluate fit

### 9. Customer Decision

#### Option A: Approve Cook
- Joining date is confirmed
- Cook joins the organization
- Application status: `Hired`
- Booking is created

#### Option B: Reject Cook
- Admin assigns another profile (if replacements available)
- Replacement counter increments
- If replacements exhausted, customer must purchase another package
- New demo scheduled for replacement cook

## API Endpoints

### Application Management

#### Select Service Package
```
POST /api/applications/:id/select-package
Body: { packageType: 'Basic' | 'Standard' | 'Premium' }
Response: Application with packageType set, status = 'Package Selected'
```

#### Schedule Demo (Protected)
```
POST /api/applications/:id/schedule-demo
Body: { demoDate, demoTime, meetingLink? }
Validation: Checks if servicePackagePaid = true
Response: Error if payment not done, else schedules demo
```

#### Reject Application
```
POST /api/applications/:id/reject
Body: { rejectionReason? }
Response: Includes replacement info (used/limit)
```

### Payment Management

#### Create Service Package Payment Order
```
POST /api/payments/create-order
Body: { 
  amount, 
  type: 'service_package',
  applicationId,
  packageType: 'Basic' | 'Standard' | 'Premium'
}
Response: Razorpay order details
```

#### Verify Service Package Payment
```
POST /api/payments/verify
Body: {
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
  type: 'service_package',
  applicationId,
  packageType
}
Response: Payment verified, Application updated to 'Package Paid'
```

#### Get Service Packages
```
GET /api/payments/service-packages
Response: List of all active service packages with pricing
```

## Database Models

### Application (Updated)
```javascript
{
  servicePackage: 'Basic' | 'Standard' | 'Premium',
  servicePackagePaymentId: ObjectId (ref: ServicePackagePayment),
  servicePackagePaid: Boolean,
  packageSelectedDate: Date,
  packagePaidDate: Date,
  status: 'Applied' | 'Shortlisted' | 'Profile Reviewed' | 
          'Package Selected' | 'Package Paid' | 'Demo Scheduled' | ...
}
```

### ServicePackagePayment (New)
```javascript
{
  application: ObjectId (ref: Application),
  customer: ObjectId (ref: User),
  packageType: 'Basic' | 'Standard' | 'Premium',
  amount: Number,
  replacementLimit: Number,
  replacementsUsed: Number,
  status: 'pending' | 'paid' | 'failed',
  razorpayOrderId: String,
  razorpayPaymentId: String,
  paidDate: Date
}
```

### ServicePackage (New)
```javascript
{
  name: 'Basic' | 'Standard' | 'Premium',
  price: Number,
  replacementLimit: Number,
  demoLimit: Number,
  features: [String],
  description: String,
  isActive: Boolean
}
```

## Application Status Flow

```
Applied 
  ↓
Shortlisted 
  ↓
Profile Reviewed 
  ↓
Package Selected (customer selects package)
  ↓
Package Paid (customer pays for package) ← CRITICAL CHECKPOINT
  ↓
Demo Scheduled (demo can only be scheduled after payment)
  ↓
Demo Conducted
  ↓
├─ Hired (if approved)
│
└─ Rejected (if not approved)
   └─ Admin assigns replacement (if available)
      └─ New demo scheduled
```

## Key Benefits

1. **Prevents Direct Deals**: Customer has already invested in package, reducing incentive to bypass platform
2. **Validates Commitment**: Payment ensures genuine hiring intent
3. **Controlled Replacements**: Package limits prevent unlimited replacement requests
4. **Revenue Generation**: Service packages create additional revenue stream
5. **Admin Control**: All replacements go through admin, maintaining transparency
6. **Clear Workflow**: Customers understand the process and payment requirements upfront

## Implementation Notes

1. Run seed file to initialize service packages:
   ```bash
   node seed_service_packages.js
   ```

2. Update frontend to:
   - Show package selection UI after profile review
   - Integrate Razorpay payment for service packages
   - Show replacement counter when rejecting cooks
   - Prevent demo scheduling without payment

3. Admin panel should:
   - Track service package payments
   - Monitor replacement usage
   - Generate reports on package sales

## Migration from Old Workflow

For existing applications:
- Set `servicePackagePaid = true` for already hired cooks
- Set `status = 'Package Paid'` for applications that should proceed to demo
- Create ServicePackagePayment records for historical data if needed
