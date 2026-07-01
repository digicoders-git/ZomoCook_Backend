const fs = require('fs');
const path = require('path');

const serviceAccount = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../collegepanel-1027b-firebase-adminsdk-fbsvc-c7187e7903.json'), 'utf8')
);

const admin = require('firebase-admin');

try {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    console.log('SUCCESS: Firebase initialized');
    process.exit(0);
} catch (e) {
    console.error('FAILED:', e.message);
    process.exit(1);
}
