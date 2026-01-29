
import { verifyUser, getClerkClient } from './_auth.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // 1. Verify Authentication
        const user = await verifyUser(req);
        
        if (!user || !user.userId) {
            console.warn("⚠️ [DriveToken] Auth failed: No user");
            return res.status(401).json({ error: "Unauthorized" });
        }

        if (!user.isVerified) {
            return res.status(403).json({ error: "Guest accounts cannot access Google Drive." });
        }

        // 2. Fetch OAuth Token from Clerk
        const clerk = getClerkClient();
        
        let tokenData = null;
        
        // Attempt 1: 'oauth_google' (Standard for Clerk v5+)
        try {
            const response = await clerk.users.getUserOauthAccessToken(user.userId, 'oauth_google');
            // Clerk returns an array of tokens or a data object containing the array
            const tokens = response.data || response || [];
            if (Array.isArray(tokens) && tokens.length > 0) {
                tokenData = tokens[0];
            }
        } catch(e) {
            console.warn(`⚠️ [DriveToken] 'oauth_google' fetch failed for ${user.userId}:`, e.message);
        }

        // Attempt 2: 'google' (Legacy/Compatibility)
        if (!tokenData) {
            try {
                const response = await clerk.users.getUserOauthAccessToken(user.userId, 'google');
                const tokens = response.data || response || [];
                if (Array.isArray(tokens) && tokens.length > 0) {
                    tokenData = tokens[0];
                }
            } catch(e) {
                console.warn(`⚠️ [DriveToken] 'google' fetch failed for ${user.userId}:`, e.message);
            }
        }

        // 3. Return Token or 404
        if (tokenData && tokenData.token) {
            return res.status(200).json({ token: tokenData.token });
        }

        // Fallback: Check if account exists but token is missing (expired/revoked)
        console.error(`❌ [DriveToken] No valid token found for user ${user.userId}`);
        
        return res.status(404).json({ 
            error: "No Drive Token Found", 
            code: "NO_DRIVE_TOKEN",
            detail: "User is logged in, but no valid OAuth token exists. Re-authentication required."
        });

    } catch (error) {
        console.error("❌ [DriveToken] Fatal Error:", error);
        return res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
}
