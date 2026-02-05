
import { createClerkClient, verifyToken } from '@clerk/backend';

// Helper to get client securely
export function getClerkClient() {
    if (!process.env.CLERK_SECRET_KEY) {
        console.error("❌ getClerkClient: CLERK_SECRET_KEY is missing");
        throw new Error("Missing CLERK_SECRET_KEY");
    }
    return createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
}

/**
 * Validates a raw token string and returns the User object.
 * Optimized to use JWT Custom Claims to avoid Clerk API Rate Limits.
 * 
 * @param {string} token 
 * @param {boolean} requireEmail - Legacy flag. Now we try to get email from token regardless.
 */
export async function getUserFromToken(token, requireEmail = false) {
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) return null;

    try {
        const verified = await verifyToken(token, {
            secretKey: secretKey,
            clockSkewInMs: 60000 
        });

        // 1. FAST PATH: Check for Custom Claims (Zero-Latency)
        // We configured Clerk to inject 'email', 'org_id', 'org_role' into the token.
        if (verified.email) {
            return {
                id: verified.sub,
                userId: verified.sub,
                email: verified.email, // Extracted directly from JWT
                orgId: verified.org_id || null,
                orgRole: verified.org_role || null,
                orgSlug: verified.org_slug || null,
                // Name and Avatar aren't crucial for backend logic usually, 
                // but we can set placeholders or fetch if absolutely critical (usually frontend handles display)
                name: 'User', 
                avatar: null, 
                isVerified: true
            };
        }

        // 2. SLOW PATH (Fallback): API Call
        // Used only if custom claims are missing (e.g. old session) AND email is required
        if (requireEmail) {
            console.log("⚠️ Auth: Falling back to slow API call (Custom Claims missing)");
            const clerk = getClerkClient();
            const user = await clerk.users.getUser(verified.sub);
            
            const primaryEmail = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress;

            return {
                id: user.id,
                userId: user.id,
                email: primaryEmail,
                name: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'User',
                avatar: user.imageUrl,
                isVerified: true
            };
        }

        // 3. LIGHTWEIGHT PATH (No Email required, Claims missing)
        return {
            id: verified.sub,
            userId: verified.sub,
            email: null,
            name: 'User',
            isVerified: true
        };

    } catch (e) {
        console.error(`Auth: Token Validation Failed. ${e.message}`);
        return null;
    }
}

/**
 * Middleware-like helper to verifyUser.
 */
export async function verifyUser(req, requireEmail = false) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.split(' ')[1].trim();
    return await getUserFromToken(token, requireEmail);
}
