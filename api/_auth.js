
import { createClerkClient } from '@clerk/backend';
import { createHmac } from 'crypto';

// 1. Initialize Client Explicitly
const secretKey = process.env.CLERK_SECRET_KEY;
if (!secretKey) {
    console.error("CRITICAL: CLERK_SECRET_KEY is missing in environment variables.");
}

const clerkClient = createClerkClient({ secretKey });

/**
 * Validates a Guest Token (HMAC SHA256)
 * Format: payloadBase64.signature
 */
function verifyGuestToken(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 2) return null;

        const [payloadStr, signature] = parts;
        // Use a fallback secret only if env is missing (development only)
        const secret = process.env.CLERK_SECRET_KEY || 'dev-fallback-secret';
        
        const expectedSignature = createHmac('sha256', secret)
            .update(payloadStr)
            .digest('base64url');

        if (signature !== expectedSignature) {
            console.warn("Auth: Guest token signature mismatch.");
            return null;
        }

        const user = JSON.parse(Buffer.from(payloadStr, 'base64url').toString());
        // Enforce Guest Role
        return { ...user, role: 'Guest', isVerified: false };
    } catch (e) {
        console.error("Auth: Guest token parsing failed", e.message);
        return null;
    }
}

/**
 * Validates a Clerk JWT
 * Uses @clerk/backend verifyToken
 */
async function verifyClerkToken(token) {
    try {
        const verifiedToken = await clerkClient.verifyToken(token, {
            secretKey: process.env.CLERK_SECRET_KEY,
            // Add leeway for clock skew between Vercel and Clerk servers
            clockSkewInMs: 10 * 1000, 
        });

        const userId = verifiedToken.sub;
        const user = await clerkClient.users.getUser(userId);
        
        const primaryEmail = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress;

        return {
            id: primaryEmail || user.id,
            userId: user.id,
            email: primaryEmail,
            name: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'User',
            role: 'Admin', // In this app, any authenticated Google user is an Admin/Creator
            isVerified: true
        };
    } catch (e) {
        console.error(`Auth: Clerk Verification Failed. Reason: ${e.message || e}`);
        return null;
    }
}

export async function verifyUser(req) {
    const authHeader = req.headers['authorization'];
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // console.warn("Auth: No Bearer token found in header.");
        return null;
    }

    const token = authHeader.split(' ')[1];

    // DECISION TREE
    
    // 1. Is it a JWT? (Starts with eyJ and has 3 parts)
    if (token.startsWith('eyJ') && token.split('.').length === 3) {
        return await verifyClerkToken(token);
    }

    // 2. Is it a custom Guest Token? (Has 2 parts)
    if (token.split('.').length === 2) {
        return verifyGuestToken(token);
    }

    console.warn("Auth: Token format unrecognized.");
    return null;
}

export { clerkClient };
