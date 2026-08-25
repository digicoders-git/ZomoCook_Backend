/**
 * Verification script for Muzztech SMS & OTP Integration
 */
require('dotenv').config();
const smsService = require('./services/smsService');
const Otp = require('./models/Otp');

async function runTests() {
    console.log('🧪 Testing Muzztech SMS Integration...\n');
    let passed = 0;
    let failed = 0;

    // Test 1: Phone number formatting
    console.log('--- Test 1: Phone Number Normalization ---');
    const testCases = [
        { input: '+919876543210', expected: '9876543210' },
        { input: '919876543210', expected: '9876543210' },
        { input: '09876543210', expected: '9876543210' },
        { input: '9876543210', expected: '9876543210' },
        { input: '+91 98765 43210', expected: '9876543210' },
        { input: '987-654-3210', expected: '9876543210' }
    ];

    for (const tc of testCases) {
        const formatted = smsService.formatPhoneNumber(tc.input);
        if (formatted === tc.expected) {
            console.log(`✅ [Format Phone] "${tc.input}" -> "${formatted}"`);
            passed++;
        } else {
            console.error(`❌ [Format Phone] "${tc.input}" -> "${formatted}" (Expected: "${tc.expected}")`);
            failed++;
        }
    }

    // Test 2: OTP Template & Defaults
    console.log('\n--- Test 2: DLT Template & Sender ID Configuration ---');
    if (smsService.DEFAULT_SENDER_NAME === 'ZOMOC') {
        console.log(`✅ Default Sender Name: ${smsService.DEFAULT_SENDER_NAME}`);
        passed++;
    } else {
        console.error(`❌ Unexpected Default Sender Name: ${smsService.DEFAULT_SENDER_NAME}`);
        failed++;
    }

    if (smsService.DEFAULT_OTP_TEMPLATE_ID === '1777178758492846293') {
        console.log(`✅ Default OTP Template ID: ${smsService.DEFAULT_OTP_TEMPLATE_ID}`);
        passed++;
    } else {
        console.error(`❌ Unexpected OTP Template ID: ${smsService.DEFAULT_OTP_TEMPLATE_ID}`);
        failed++;
    }

    // Test 3: OTP Model Schema Expiry
    console.log('\n--- Test 3: Otp Model Expiry ---');
    const createdAtField = Otp.schema.path('createdAt');
    const expiresOption = createdAtField?.options?.expires;
    if (expiresOption === 600) {
        console.log(`✅ Otp Schema TTL expiry is ${expiresOption} seconds (10 minutes matching template).`);
        passed++;
    } else {
        console.error(`❌ Otp Schema TTL expiry is ${expiresOption} (Expected: 600)`);
        failed++;
    }

    // Test 4: sendOtpSms execution (graceful fallback/simulation)
    console.log('\n--- Test 4: sendOtpSms Execution ---');
    const result = await smsService.sendOtpSms('9876543210', '123456');
    if (result && (result.success || result.simulated)) {
        console.log(`✅ sendOtpSms returned success:`, result);
        passed++;
    } else {
        console.error(`❌ sendOtpSms failed:`, result);
        failed++;
    }

    console.log(`\n========================================`);
    console.log(`📊 Test Summary: Passed: ${passed} | Failed: ${failed}`);
    console.log(`========================================\n`);

    if (failed > 0) {
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});
