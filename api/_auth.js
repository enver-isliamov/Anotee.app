
import { createClerkClient, verifyToken } from '@clerk/backend';

/**
 * Validates the auth token from the request headers using Clerk.
 * Guests are no longer supported.
 */
export async function verifyUser(req) {
    // 1. Critical Environment Check
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) {
        console.error("❌ CRITICAL: CLERK_SECRET_KEY is missing in Vercel Environment Variables.");
        return null;
    }

    // 2. Extract Token
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.split(' ')[1].trim();

    // 3. Verify Token with Clerk
    try {
        const verified = await verifyToken(token, {
            secretKey: secretKey,
            clockSkewInMs: 60000 
        });

        // Initialize client to fetch user details
        const clerk = createClerkClient({ secretKey });

        // Token is valid, now fetch full user details for roles/email
        const user = await clerk.users.getUser(verified.sub);
        
        const primaryEmail = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress;

        return {
            id: primaryEmail || user.id,
            userId: user.id,
            email: primaryEmail,
            name: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'User',
            avatar: user.imageUrl,
            isVerified: true
            // Role is removed. Permissions should be checked against Project resources.
        };

    } catch (e) {
        console.error(`⛔ Auth: Clerk Token Verification Failed. Reason: ${e.message}`);
        return null;
    }
}

// Export a getter for the client if needed elsewhere
export function getClerkClient() {
    if (!process.env.CLERK_SECRET_KEY) {
        console.error("❌ getClerkClient: CLERK_SECRET_KEY is missing");
        throw new Error("Missing CLERK_SECRET_KEY");
    }
    return createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
}
