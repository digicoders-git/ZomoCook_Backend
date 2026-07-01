const admin = require('firebase-admin');

if (!admin.apps.length) {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
    privateKey = privateKey.replace(/^\"|\"$/g, '').replace(/^'|'$/g, '');
    privateKey = privateKey.split('\\n').join('\n');

    console.log('[Firebase] Key starts with:', privateKey.substring(0, 27));
    console.log('[Firebase] Has real newlines:', privateKey.includes('\n'));

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
