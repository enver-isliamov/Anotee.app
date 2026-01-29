
import { verifyUser, getClerkClient } from './_auth.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // 1. Verify Authentication
        const user = await verifyUser(req);
        
        if (!user) {
            console.warn("DriveToken: 401 - User verification failed.");
            return res.status(401).json({ error: "Unauthorized. Please re-login." });
        }

        if (!user.isVerified) {
            // Guest user trying to access Drive
            return res.status(403).json({ error: "Guest accounts cannot access Google Drive." });
        }

        // 2. Fetch OAuth Token from Clerk
        // We need the 'oauth_google' token specifically
        const clerk = getClerkClient();
        
        let oauthTokens;
        try {
            oauthTokens = await clerk.users.getUserOauthAccessToken(user.userId, 'oauth_google');
        } catch (clerkApiError) {
            console.error("DriveToken: Clerk API Error:", clerkApiError);
            return res.status(502).json({ error: "Upstream Auth Provider Error" });
        }

        // 3. Return Token or 404
        if (oauthTokens.data && oauthTokens.data.length > 0) {
            const tokenData = oauthTokens.data[0];
            
            // Check if scopes are granted (basic check)
            const scopes = tokenData.scopes || [];
            // Note: Clerk sometimes returns scopes as a single string or array.
            // We just pass the token to frontend; frontend handles scope validation logic via Profile.tsx
            
            return res.status(200).json({ token: tokenData.token });
        } else {
            console.warn(`DriveToken: User ${user.userId} has no Google OAuth tokens.`);
            return res.status(404).json({ 
                error: "Drive Not Connected", 
                code: "NO_DRIVE_TOKEN" 
            });
        }

    } catch (error) {
        console.error("❌ DriveToken Fatal Error:", error);
        return res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
}
