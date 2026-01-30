
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
 * Optimized to avoid hitting Clerk API Rate Limits.
 * 
 * @param {string} token 
 * @param {boolean} requireEmail - If false, skips the heavy API call to fetch email/avatar.
 */
export async function getUserFromToken(token, requireEmail = false) {
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) return null;

    try {
        const verified = await verifyToken(token, {
            secretKey: secretKey,
            clockSkewInMs: 60000 
        });

        // 1. LIGHTWEIGHT PATH: Just return ID from JWT
        // This saves API calls for Uploads, Deletes, and simple Checks
        if (!requireEmail) {
            return {
                id: verified.sub,
                userId: verified.sub,
                email: null, // Email not available without API call
                name: 'User', // Placeholder
                isVerified: true
            };
        }

        // 2. HEAVY PATH: Fetch full profile (Only for Listings/Invites)
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
    } catch (e) {
        console.error(`Auth: Token Validation Failed. ${e.message}`);
        return null;
    }
}

/**
 * Middleware-like helper to verifyUser.
 * Defaults to Lightweight check to prevent 429 Errors.
 */
export async function verifyUser(req, requireEmail = false) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.split(' ')[1].trim();
    return await getUserFromToken(token, requireEmail);
}
