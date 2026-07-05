const http = require('http');

// Test endpoints
const tests = [
  {
    name: 'GET / - Server Health Check',
    method: 'GET',
    path: '/',
    expectedStatus: 200,
  },
  {
    name: 'GET /api/payments/service-packages - Get Service Packages',
    method: 'GET',
    path: '/api/payments/service-packages',
    expectedStatus: 200,
    headers: {
      'Authorization': 'Bearer test_token',
    },
  },
];

async function runTests() {
  console.log('🧪 Starting API Endpoint Tests...\n');
  
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const result = await makeRequest(test);
      
      if (result.status === test.expectedStatus) {
        console.log(`✅ PASS: ${test.name}`);
        console.log(`   Status: ${result.status}`);
        passed++;
      } else {
        console.log(`❌ FAIL: ${test.name}`);
        console.log(`   Expected: ${test.expectedStatus}, Got: ${result.status}`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ERROR: ${test.name}`);
      console.log(`   ${error.message}`);
      failed++;
    }
    console.log('');
  }

  console.log(`\n📊 Test Results:`);
  console.log(`   Passed: ${passed}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Total: ${passed + failed}`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed!');
  } else {
    console.log(`\n⚠️  ${failed} test(s) failed`);
  }
}

function makeRequest(test) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5001,
      path: test.path,
      method: test.method,
      headers: {
        'Content-Type': 'application/json',
        ...test.headers,
      },
      timeout: 5000,
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          status: res.statusCode,
          data: data,
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (test.body) {
      req.write(JSON.stringify(test.body));
    }

    req.end();
  });
}

// Run tests
runTests().catch(console.error);
