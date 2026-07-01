const admin = require('firebase-admin');

if (!admin.apps.length) {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (privateKey) {
        // Remove surrounding quotes if present
        privateKey = privateKey.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
        // If key has literal \n (escaped), replace with real newlines
        // If key already has real newlines, this won't affect it
        if (!privateKey.includes('\n')) {
            privateKey = privateKey.replace(/\\n/g, '\n');
        }
    }

    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: privateKey
        })
    });
}

module.exports = admin;

