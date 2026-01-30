
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
 * Used by verifyUser and other internal APIs (like upload).
 */
export async function getUserFromToken(token) {
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) return null;

    try {
        const verified = await verifyToken(token, {
            secretKey: secretKey,
            clockSkewInMs: 60000 
        });

        const clerk = getClerkClient();
        const user = await clerk.users.getUser(verified.sub);
        
        const primaryEmail = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress;

        return {
            id: primaryEmail || user.id, // Legacy compat: prefer email if available for ID match, else Clerk ID
            userId: user.id, // Explicit Clerk ID
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
 * Middleware-like helper to verify user from Request Headers
 */
export async function verifyUser(req) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.split(' ')[1].trim();
    return await getUserFromToken(token);
}
