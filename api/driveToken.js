
import { verifyUser, clerkClient } from './_auth.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const user = await verifyUser(req);
        
        if (!user || !user.isVerified) {
            return res.status(401).json({ error: "Unauthorized. Please login with Google." });
        }

        // Retrieve the Google OAuth Access Token from Clerk
        // We assume the provider is 'oauth_google'
        const response = await clerkClient.users.getUserOauthAccessToken(user.userId, 'oauth_google');
        
        if (response.data && response.data.length > 0) {
            const tokenData = response.data[0];
            return res.status(200).json({ token: tokenData.token });
        } else {
            console.warn("No Google OAuth token found for user", user.userId);
            return res.status(404).json({ error: "No Google Drive connection found. Please re-login." });
        }

    } catch (error) {
        console.error("Drive Token Error:", error);
        return res.status(500).json({ error: error.message });
    }
}
