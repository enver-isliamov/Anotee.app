
import { verifyUser, clerkClient } from './_auth.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // 1. Verify User (Must be Clerk/Google user, not Guest)
        const user = await verifyUser(req);
        
        if (!user) {
            console.warn("DriveToken: No user found from token.");
            return res.status(401).json({ error: "Unauthorized" });
        }

        if (!user.isVerified) {
            return res.status(403).json({ error: "Guests cannot access Drive." });
        }

        // 2. Fetch OAuth Token from Clerk
        // We explicitly look for 'oauth_google' provider
        let response;
        try {
            response = await clerkClient.users.getUserOauthAccessToken(user.userId, 'oauth_google');
        } catch (clerkErr) {
            console.error("DriveToken: Clerk API error", clerkErr);
            return res.status(500).json({ error: "Failed to communicate with Auth provider" });
        }
        
        // 3. Check for Token existence
        if (response.data && response.data.length > 0) {
            const tokenData = response.data[0];
            
            // Optional: Check scopes if Clerk returns them, but usually simply having the token is enough here.
            // The frontend handles the scope verification logic.
            
            return res.status(200).json({ token: tokenData.token });
        } else {
            // Valid user, but no Google connection found in Clerk
            console.log(`DriveToken: User ${user.userId} has no Google OAuth tokens.`);
            return res.status(404).json({ error: "Google Drive not connected" });
        }

    } catch (error) {
        console.error("DriveToken Critical Error:", error);
        return res.status(500).json({ error: error.message });
    }
}
