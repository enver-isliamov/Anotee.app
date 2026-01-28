
import { createHmac } from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch(e) {}
    }

    const { name } = body;

    if (!name) {
        return res.status(400).json({ error: "Name is required" });
    }

    // 1. Generate User Data
    const userId = `guest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const user = {
      id: userId,
      userId: userId, // For consistency
      name: name,
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${name}`,
      role: 'Guest',
      isVerified: false
    };

    // 2. Sign the token (HMAC SHA256)
    // We use CLERK_SECRET_KEY as our signing secret since it's already secured in env vars
    const secret = process.env.CLERK_SECRET_KEY || 'dev-fallback-secret';
    
    // Create payload
    const payloadStr = Buffer.from(JSON.stringify(user)).toString('base64url');
    
    // Sign payload
    const signature = createHmac('sha256', secret)
        .update(payloadStr)
        .digest('base64url');

    // Token format: payload.signature
    const token = `${payloadStr}.${signature}`;

    return res.status(200).json({ success: true, user, token });

  } catch (error) {
    console.error("Guest login error:", error);
    return res.status(500).json({ error: error.message });
  }
}
