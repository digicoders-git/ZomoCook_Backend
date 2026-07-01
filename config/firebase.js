const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
    const serviceAccount = require(path.join(__dirname, '../collegepanel-1027b-firebase-adminsdk-fbsvc-c7187e7903.json'));
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('[Firebase] Initialized. Project:', serviceAccount.project_id);
}

module.exports = admin;
