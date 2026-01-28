
import { createClerkClient } from '@clerk/backend';

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

export async function verifyUser(req) {
    // 1. Check for Guest ID first (Manual Header)
    const guestId = req.headers['x-guest-id'];
    if (guestId && guestId.startsWith('guest-')) {
        return {
            id: guestId,
            userId: guestId,
            name: 'Guest',
            role: 'Guest',
            isVerified: false
        };
    }

    // 2. Check for Clerk Authentication
    try {
        // authenticateRequest looks for the standard Clerk cookies or Authorization Bearer header
        const { isSignedIn, toAuth } = await clerkClient.authenticateRequest(req, {
            jwtKey: process.env.CLERK_JWT_KEY,
            secretKey: process.env.CLERK_SECRET_KEY,
        });

        if (isSignedIn) {
            const auth = toAuth();
            if (!auth || !auth.userId) return null;

            // Optional: Fetch full user details if needed, but for speed we might just use the ID.
            // For now, let's fetch basic info to emulate the old object structure
            const user = await clerkClient.users.getUser(auth.userId);
            
            const primaryEmail = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress;

            return {
                id: primaryEmail || user.id, // Keep using email as ID if possible for backward compat, or user.id
                userId: user.id, // Clerk ID
                email: primaryEmail,
                name: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'User',
                role: 'Admin', // Clerk users are always "Authenticated"
                isVerified: true
            };
        }
    } catch (e) {
        console.error("Clerk Auth Error:", e);
    }

    return null;
}

export { clerkClient };
