
import { createClerkClient } from '@clerk/backend';
import { createHmac } from 'crypto';

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

export async function verifyUser(req) {
    // Check Authorization Header
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.split(' ')[1];

    // 1. Try Custom Guest Token Verification (HMAC)
    // Custom tokens look like "base64Payload.base64Signature"
    if (token.includes('.')) {
        const parts = token.split('.');
        // Clerk JWTs have 3 parts, our Guest tokens have 2 parts
        if (parts.length === 2) {
            const [payloadStr, signature] = parts;
            const secret = process.env.CLERK_SECRET_KEY || 'dev-fallback-secret';
            
            const expectedSignature = createHmac('sha256', secret)
                .update(payloadStr)
                .digest('base64url');

            if (signature === expectedSignature) {
                try {
                    const user = JSON.parse(Buffer.from(payloadStr, 'base64url').toString());
                    return user;
                } catch (e) {
                    console.error("Guest token parse error", e);
                }
            }
        }
    }

    // 2. Try Clerk Authentication (Standard JWT)
    try {
        const { isSignedIn, toAuth } = await clerkClient.authenticateRequest(req, {
            secretKey: process.env.CLERK_SECRET_KEY,
        });

        if (isSignedIn) {
            const auth = toAuth();
            if (!auth || !auth.userId) return null;

            const user = await clerkClient.users.getUser(auth.userId);
            const primaryEmail = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress;

            return {
                id: primaryEmail || user.id,
                userId: user.id,
                email: primaryEmail,
                name: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'User',
                role: 'Admin',
                isVerified: true
            };
        }
    } catch (e) {
        // Clerk verification failed or token was invalid for Clerk
        // Silent fail is fine here as we return null
    }

    return null;
}

export { clerkClient };
