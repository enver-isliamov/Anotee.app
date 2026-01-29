
import { verifyUser, getClerkClient } from './_auth.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // 1. Verify Authentication
        const user = await verifyUser(req);
        
        if (!user || !user.userId) {
            console.warn("❌ [DriveToken] Auth failed");
            return res.status(401).json({ error: "Unauthorized" });
        }

        if (!user.isVerified) {
            return res.status(403).json({ error: "Guest accounts cannot access Google Drive." });
        }

        // 2. Fetch OAuth Token from Clerk
        const clerk = getClerkClient();
        
        let tokens = [];
        try {
            // First try standard ID
            const response = await clerk.users.getUserOauthAccessToken(user.userId, 'oauth_google');
            tokens = response.data || response || [];
        } catch(e) {
            console.warn("Standard oauth_google failed, trying google...");
            try {
                // Fallback for some legacy setups
                const response = await clerk.users.getUserOauthAccessToken(user.userId, 'google');
                tokens = response.data || response || [];
            } catch(e2) {
                console.error("Both token fetch attempts failed");
            }
        }

        if (Array.isArray(tokens) && tokens.length > 0) {
            const tokenData = tokens[0];
            const hasDriveScope = tokenData.scopes ? tokenData.scopes.includes('drive.file') : true;
            
            if (hasDriveScope) {
                return res.status(200).json({ token: tokenData.token });
            }
            console.warn("⚠️ [DriveToken] Token found but might lack scope:", tokenData.scopes);
        }

        // 3. Fallback
        const fullUser = await clerk.users.getUser(user.userId);
        const googleAccount = fullUser.externalAccounts.find(a => a.provider === 'google' || a.verification?.strategy === 'oauth_google');

        console.error(`❌ [DriveToken] No token found for user ${user.userId}. Google Account Linked: ${!!googleAccount}`);

        return res.status(404).json({ 
            error: "Drive Not Connected", 
            code: "NO_DRIVE_TOKEN",
            debug_info: {
                has_google_account: !!googleAccount,
                approved_scopes: googleAccount ? googleAccount.approvedScopes : 'N/A',
                tokens_found: tokens.length
            }
        });

    } catch (error) {
        console.error("❌ [DriveToken] Fatal Error:", error);
        return res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
}
