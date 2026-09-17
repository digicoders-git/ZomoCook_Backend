const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

if (!admin.apps.length) {
    let serviceAccount = null;

    // Check for JSON service account file in project directory
    const possiblePaths = [
        path.join(__dirname, '../collegepanel-1027b-firebase-adminsdk-fbsvc-c7187e7903.json'),
        path.join(__dirname, '../serviceAccountKey.json'),
        path.join(__dirname, '../../collegepanel-1027b-firebase-adminsdk-fbsvc-c7187e7903.json')
    ];

    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            try {
                serviceAccount = JSON.parse(fs.readFileSync(p, 'utf8'));
                console.log(`[Firebase] Loaded service account from ${path.basename(p)}`);
                break;
            } catch (e) {
                console.error(`[Firebase] Failed to parse ${p}:`, e.message);
            }
        }
    }

    // Fallback to environment variables
    if (!serviceAccount) {
        let rawKey = (process.env.FIREBASE_PRIVATE_KEY || '').trim();
        if ((rawKey.startsWith("'") && rawKey.endsWith("'")) || (rawKey.startsWith('"') && rawKey.endsWith('"'))) {
            rawKey = rawKey.slice(1, -1).trim();
        }
        const privateKey = rawKey.replace(/\\n/g, '\n');
        serviceAccount = {
            type: "service_account",
            project_id: process.env.FIREBASE_PROJECT_ID,
            private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
            private_key: privateKey,
            client_email: process.env.FIREBASE_CLIENT_EMAIL,
            client_id: process.env.FIREBASE_CLIENT_ID,
            auth_uri: "https://accounts.google.com/o/oauth2/auth",
            token_uri: "https://oauth2.googleapis.com/token",
        };
    }

    try {
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        console.log('[Firebase] Initialized successfully with project:', serviceAccount.project_id);
    } catch (initErr) {
        console.error('[Firebase] Initialization error:', initErr.message);
    }
}

module.exports = admin;
