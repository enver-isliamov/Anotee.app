
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
    // Custom tokens look like "base64Payload.base64Signature" (2 parts)
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
        // Use verifyToken directly on the string to avoid Request object incompatibility issues
        // We pass the secretKey explicitly to ensure it's used if the client instance didn't pick it up perfectly
        const verifiedToken = await clerkClient.verifyToken(token);
        
        if (verifiedToken) {
            const userId = verifiedToken.sub;
            const user = await clerkClient.users.getUser(userId);
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
        // Token expired, invalid, or network error fetching user
        console.error("Clerk Auth Error:", e.message);
    }

    return null;
}

export { clerkClient };
