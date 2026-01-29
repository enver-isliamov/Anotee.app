
import { verifyUser, getClerkClient } from './_auth.js';

export default async function handler(req, res) {
    console.log("🔹 [DriveToken] Request started");

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // 1. Verify Authentication
        const user = await verifyUser(req);
        
        if (!user) {
            console.warn("❌ [DriveToken] Auth failed: No user returned from verifyUser");
            return res.status(401).json({ error: "Unauthorized. Please re-login." });
        }

        console.log(`👤 [DriveToken] User Verified: ${user.userId} (${user.email})`);

        if (!user.isVerified) {
            return res.status(403).json({ error: "Guest accounts cannot access Google Drive." });
        }

        // 2. Fetch OAuth Token from Clerk
        const clerk = getClerkClient();
        
        console.log(`🔄 [DriveToken] Requesting 'oauth_google' token from Clerk for ${user.userId}...`);
        
        let oauthTokens;
        try {
            oauthTokens = await clerk.users.getUserOauthAccessToken(user.userId, 'oauth_google');
            
            // LOGGING THE RAW RESPONSE STRUCTURE (Safe - tokens are usually long, we just want to see if array exists)
            console.log("📦 [DriveToken] Clerk Response Data:", JSON.stringify(oauthTokens.data, null, 2));
            console.log("📦 [DriveToken] Clerk Response Total Count:", oauthTokens.totalCount);

        } catch (clerkApiError) {
            console.error("💥 [DriveToken] Clerk API CRITICAL ERROR:", clerkApiError);
            // Log specific Clerk error details if available
            if (clerkApiError.errors) {
                console.error("💥 [DriveToken] Clerk Errors Detail:", JSON.stringify(clerkApiError.errors, null, 2));
            }
            return res.status(502).json({ error: "Upstream Auth Provider Error", details: clerkApiError.message });
        }

        // 3. Return Token or 404
        if (oauthTokens.data && oauthTokens.data.length > 0) {
            const tokenData = oauthTokens.data[0];
            
            // Check scopes inside the token data if available
            console.log("✅ [DriveToken] Token found. Scopes:", tokenData.scopes || "Not listed in response");
            
            return res.status(200).json({ token: tokenData.token });
        } else {
            console.warn(`⚠️ [DriveToken] No tokens returned. Array is empty.`);
            return res.status(404).json({ 
                error: "Drive Not Connected", 
                code: "NO_DRIVE_TOKEN",
                debug_clerk_response: oauthTokens.data 
            });
        }

    } catch (error) {
        console.error("❌ [DriveToken] Unhandled Fatal Error:", error);
        return res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
}
