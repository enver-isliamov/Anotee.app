
import { createClerkClient } from '@clerk/backend';
import { createHmac } from 'crypto';

/**
 * Validates the auth token from the request headers.
 * Supports both Clerk JWTs (Standard Users) and Custom HMAC Tokens (Guests).
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

    // 3. Determine Token Type
    // JWT has 3 parts (header.payload.signature), our Guest token has 2 (payload.signature)
    const parts = token.split('.');
    const isGuestToken = parts.length === 2;
    const isClerkToken = parts.length === 3;

    if (isGuestToken) {
        return verifyGuestToken(token, secretKey);
    } else if (isClerkToken) {
        return await verifyClerkToken(token, secretKey);
    }

    console.warn("⚠️ Auth: Unknown token format (parts length: " + parts.length + ")");
    return null;
}

// --- HELPER FUNCTIONS ---

function verifyGuestToken(token, secret) {
    try {
        const [payloadStr, signature] = token.split('.');
        
        // Re-create signature
        const expectedSignature = createHmac('sha256', secret)
            .update(payloadStr)
            .digest('base64url');

        if (signature !== expectedSignature) {
            console.warn("⛔ Auth: Guest signature mismatch");
            return null;
        }

        const user = JSON.parse(Buffer.from(payloadStr, 'base64url').toString());
        // Enforce guest structure
        return { 
            ...user, 
            role: 'Guest', 
            isVerified: false // Guests are never "verified" for external API usage like Drive
        };
    } catch (e) {
        console.error("❌ Auth: Guest token parse error", e.message);
        return null;
    }
}

async function verifyClerkToken(token, secretKey) {
    try {
        // Initialize client locally to ensure Env vars are picked up
        const clerk = createClerkClient({ secretKey });

        const verified = await clerk.verifyToken(token, {
            secretKey: secretKey,
            // Allow 60s clock skew to prevent 401s on slight server time diffs
            clockSkewInMs: 60000 
        });

        // Token is valid, now fetch full user details for roles/email
        const user = await clerk.users.getUser(verified.sub);
        
        const primaryEmail = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress;

        return {
            id: primaryEmail || user.id,
            userId: user.id,
            email: primaryEmail,
            name: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'User',
            avatar: user.imageUrl,
            role: 'Admin', // In this app, all Google-auth users are Admins/Creators
            isVerified: true
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
