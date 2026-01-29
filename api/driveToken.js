
import { verifyUser, getClerkClient } from './_auth.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // 1. Verify Authentication
        const user = await verifyUser(req);
        
        if (!user || !user.userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        if (!user.isVerified) {
            return res.status(403).json({ error: "Guest accounts cannot access Google Drive." });
        }

        // 2. Fetch OAuth Token from Clerk
        const clerk = getClerkClient();
        
        let tokens = [];
        
        // Strategy 1: Try 'oauth_google' (Standard)
        try {
            const response = await clerk.users.getUserOauthAccessToken(user.userId, 'oauth_google');
            tokens = response.data || response || [];
        } catch(e) {
            // Strategy 2: Try 'google' (Legacy/Alternative)
            try {
                const response = await clerk.users.getUserOauthAccessToken(user.userId, 'google');
                tokens = response.data || response || [];
            } catch(e2) {
                console.error("Token fetch failed for both providers");
            }
        }

        if (Array.isArray(tokens) && tokens.length > 0) {
            const tokenData = tokens[0];
            // Optional: Check scope presence if provided in token data
            // const hasScope = tokenData.scopes?.includes('drive.file'); 
            
            return res.status(200).json({ token: tokenData.token });
        }

        // 3. Detailed Failure Response
        return res.status(404).json({ 
            error: "No Drive Token Found", 
            code: "NO_DRIVE_TOKEN",
            detail: "User is logged in, but has not granted Google Drive permissions or token is expired."
        });

    } catch (error) {
        console.error("❌ [DriveToken] Fatal Error:", error);
        return res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
}
