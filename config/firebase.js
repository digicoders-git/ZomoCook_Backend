const admin = require('firebase-admin');

if (!admin.apps.length) {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
    
    // Strip surrounding quotes if any
    privateKey = privateKey.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
    
    // Handle both escaped \n and real newlines
    privateKey = privateKey.replace(/\\n/g, '\n');

    // Validate key format
    if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
        console.error('[Firebase] FIREBASE_PRIVATE_KEY is missing or malformed!');
        process.exit(1);
    }

    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: privateKey
        })
    });
    
    console.log('[Firebase] Initialized. Project:', process.env.FIREBASE_PROJECT_ID);
}

module.exports = admin;

module.exports = admin;

