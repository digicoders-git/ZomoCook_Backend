const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

if (!admin.apps.length) {
    const serviceAccountPath = path.join(__dirname, '../collegepanel-1027b-firebase-adminsdk-fbsvc-c7187e7903.json');
    let credential;

    if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = require(serviceAccountPath);
        credential = admin.credential.cert(serviceAccount);
        console.log('[Firebase] Initialized using service account JSON. Project:', serviceAccount.project_id);
    } else {
        let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
        
        // Strip surrounding quotes if any
        privateKey = privateKey.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
        
        // Handle both escaped \n and real newlines
        privateKey = privateKey.replace(/\\n/g, '\n');

        if (!privateKey || !process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL) {
            console.error('[Firebase] Error: Missing Firebase credentials (both JSON file and environment variables are missing/incomplete)');
            process.exit(1);
        }

        credential = admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: privateKey
        });
        console.log('[Firebase] Initialized using environment variables. Project:', process.env.FIREBASE_PROJECT_ID);
    }

    admin.initializeApp({
        credential: credential
    });
}

module.exports = admin;
