const admin = require('firebase-admin');

if (!admin.apps.length) {
    const serviceAccount = {
        type: "service_account",
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: (process.env.FIREBASE_PRIVATE_KEY || '').split('\\n').join('\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
    };

    console.log('[Firebase] project_id:', serviceAccount.project_id);
    console.log('[Firebase] client_email:', serviceAccount.client_email);
    console.log('[Firebase] key starts:', serviceAccount.private_key.substring(0, 27));
    console.log('[Firebase] key length:', serviceAccount.private_key.length);

    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    console.log('[Firebase] Initialized successfully');
}

module.exports = admin;
