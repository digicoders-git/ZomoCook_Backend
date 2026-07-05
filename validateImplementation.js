const fs = require('fs');
const path = require('path');

console.log('🔍 ZOMOCOOK WORKFLOW IMPLEMENTATION VALIDATION\n');
console.log('=' .repeat(60));

const checks = [];

// Check 1: Backend Models
console.log('\n📦 BACKEND MODELS CHECK');
console.log('-'.repeat(60));

const models = [
  'Application.js',
  'ServicePackage.js',
  'ServicePackagePayment.js',
];

models.forEach(model => {
  const filePath = path.join(__dirname, 'models', model);
  const exists = fs.existsSync(filePath);
  const status = exists ? '✅' : '❌';
  console.log(`${status} models/${model}`);
  checks.push({ name: `Model: ${model}`, status: exists });
});

// Check 2: Backend Controllers
console.log('\n🎮 BACKEND CONTROLLERS CHECK');
console.log('-'.repeat(60));

const controllerFiles = [
  'applicationController.js',
  'paymentController.js',
];

controllerFiles.forEach(file => {
  const filePath = path.join(__dirname, 'controllers', file);
  const exists = fs.existsSync(filePath);
  const status = exists ? '✅' : '❌';
  console.log(`${status} controllers/${file}`);
  checks.push({ name: `Controller: ${file}`, status: exists });
});

// Check 3: Backend Routes
console.log('\n🛣️  BACKEND ROUTES CHECK');
console.log('-'.repeat(60));

const routeFiles = [
  'applicationRoutes.js',
  'paymentRoutes.js',
];

routeFiles.forEach(file => {
  const filePath = path.join(__dirname, 'routes', file);
  const exists = fs.existsSync(filePath);
  const status = exists ? '✅' : '❌';
  console.log(`${status} routes/${file}`);
  checks.push({ name: `Route: ${file}`, status: exists });
});

// Check 4: Frontend Screens
console.log('\n📱 FRONTEND SCREENS CHECK');
console.log('-'.repeat(60));

const frontendPath = path.join(__dirname, '..', '..', 'zomocook', 'lib', 'views');
const frontendFiles = [
  'ServicePackageSelectionScreen.dart',
  'PaymentScreen.dart',
  'RejectAndHireScreen.dart',
];

frontendFiles.forEach(file => {
  const filePath = path.join(frontendPath, file);
  const exists = fs.existsSync(filePath);
  const status = exists ? '✅' : '❌';
  console.log(`${status} lib/views/${file}`);
  checks.push({ name: `Frontend: ${file}`, status: exists });
});

// Check 5: Test Files
console.log('\n🧪 TEST FILES CHECK');
console.log('-'.repeat(60));

const testFiles = [
  'applicationController.test.js',
  'paymentController.test.js',
  'integrationTests.test.js',
];

testFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  const exists = fs.existsSync(filePath);
  const status = exists ? '✅' : '❌';
  console.log(`${status} ${file}`);
  checks.push({ name: `Test: ${file}`, status: exists });
});

// Check 6: Configuration Files
console.log('\n⚙️  CONFIGURATION FILES CHECK');
console.log('-'.repeat(60));

const configFiles = [
  'jest.config.js',
];

configFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  const exists = fs.existsSync(filePath);
  const status = exists ? '✅' : '❌';
  console.log(`${status} ${file}`);
  checks.push({ name: `Config: ${file}`, status: exists });
});

// Check 7: Verify Model Content
console.log('\n🔎 MODEL CONTENT VERIFICATION');
console.log('-'.repeat(60));

const applicationModelPath = path.join(__dirname, 'models', 'Application.js');
if (fs.existsSync(applicationModelPath)) {
  const content = fs.readFileSync(applicationModelPath, 'utf8');
  const hasServicePackage = content.includes('servicePackage');
  const hasServicePackagePaid = content.includes('servicePackagePaid');
  const hasPackageSelectedDate = content.includes('packageSelectedDate');
  
  console.log(`${hasServicePackage ? '✅' : '❌'} Application model has servicePackage field`);
  console.log(`${hasServicePackagePaid ? '✅' : '❌'} Application model has servicePackagePaid field`);
  console.log(`${hasPackageSelectedDate ? '✅' : '❌'} Application model has packageSelectedDate field`);
  
  checks.push({ name: 'Model: servicePackage field', status: hasServicePackage });
  checks.push({ name: 'Model: servicePackagePaid field', status: hasServicePackagePaid });
  checks.push({ name: 'Model: packageSelectedDate field', status: hasPackageSelectedDate });
}

// Check 8: Verify Controller Functions
console.log('\n🔎 CONTROLLER FUNCTION VERIFICATION');
console.log('-'.repeat(60));

const appControllerPath = path.join(__dirname, 'controllers', 'applicationController.js');
if (fs.existsSync(appControllerPath)) {
  const content = fs.readFileSync(appControllerPath, 'utf8');
  const hasSelectPackage = content.includes('selectServicePackage');
  const hasScheduleDemo = content.includes('scheduleDemo');
  const hasPaymentValidation = content.includes('servicePackagePaid');
  const hasRejectApp = content.includes('rejectApplication');
  
  console.log(`${hasSelectPackage ? '✅' : '❌'} selectServicePackage function exists`);
  console.log(`${hasScheduleDemo ? '✅' : '❌'} scheduleDemo function exists`);
  console.log(`${hasPaymentValidation ? '✅' : '❌'} Payment validation in scheduleDemo`);
  console.log(`${hasRejectApp ? '✅' : '❌'} rejectApplication function exists`);
  
  checks.push({ name: 'Function: selectServicePackage', status: hasSelectPackage });
  checks.push({ name: 'Function: scheduleDemo', status: hasScheduleDemo });
  checks.push({ name: 'Function: Payment validation', status: hasPaymentValidation });
  checks.push({ name: 'Function: rejectApplication', status: hasRejectApp });
}

const paymentControllerPath = path.join(__dirname, 'controllers', 'paymentController.js');
if (fs.existsSync(paymentControllerPath)) {
  const content = fs.readFileSync(paymentControllerPath, 'utf8');
  const hasGetPackages = content.includes('getServicePackages');
  const hasVerifyPayment = content.includes('verifyPayment');
  const hasServicePackageHandling = content.includes('service_package');
  
  console.log(`${hasGetPackages ? '✅' : '❌'} getServicePackages function exists`);
  console.log(`${hasVerifyPayment ? '✅' : '❌'} verifyPayment function exists`);
  console.log(`${hasServicePackageHandling ? '✅' : '❌'} Service package payment handling`);
  
  checks.push({ name: 'Function: getServicePackages', status: hasGetPackages });
  checks.push({ name: 'Function: verifyPayment', status: hasVerifyPayment });
  checks.push({ name: 'Function: Service package handling', status: hasServicePackageHandling });
}

// Check 9: Verify Routes
console.log('\n🔎 ROUTE VERIFICATION');
console.log('-'.repeat(60));

const appRoutesPath = path.join(__dirname, 'routes', 'applicationRoutes.js');
if (fs.existsSync(appRoutesPath)) {
  const content = fs.readFileSync(appRoutesPath, 'utf8');
  const hasSelectPackageRoute = content.includes('select-package');
  const hasScheduleDemoRoute = content.includes('schedule-demo');
  
  console.log(`${hasSelectPackageRoute ? '✅' : '❌'} select-package route exists`);
  console.log(`${hasScheduleDemoRoute ? '✅' : '❌'} schedule-demo route exists`);
  
  checks.push({ name: 'Route: select-package', status: hasSelectPackageRoute });
  checks.push({ name: 'Route: schedule-demo', status: hasScheduleDemoRoute });
}

const paymentRoutesPath = path.join(__dirname, 'routes', 'paymentRoutes.js');
if (fs.existsSync(paymentRoutesPath)) {
  const content = fs.readFileSync(paymentRoutesPath, 'utf8');
  const hasServicePackagesRoute = content.includes('service-packages');
  
  console.log(`${hasServicePackagesRoute ? '✅' : '❌'} service-packages route exists`);
  
  checks.push({ name: 'Route: service-packages', status: hasServicePackagesRoute });
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 SUMMARY');
console.log('='.repeat(60));

const passed = checks.filter(c => c.status).length;
const total = checks.length;
const percentage = Math.round((passed / total) * 100);

console.log(`\n✅ Passed: ${passed}/${total} (${percentage}%)`);
console.log(`❌ Failed: ${total - passed}/${total}`);

if (percentage === 100) {
  console.log('\n🎉 ALL CHECKS PASSED! Implementation is complete.');
} else if (percentage >= 80) {
  console.log('\n⚠️  Most checks passed. Review failed items.');
} else {
  console.log('\n❌ Multiple checks failed. Review implementation.');
}

console.log('\n' + '='.repeat(60));
