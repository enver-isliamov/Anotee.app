
import { sql } from '@vercel/postgres';
import { verifyUser } from '../_auth.js';
import { encrypt } from '../_crypto.js';

export default async function handler(req, res) {
    try {
        // 1. Auth Check
        const user = await verifyUser(req);
        if (!user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        // 2. Lazy DB Migration
        await sql`
            CREATE TABLE IF NOT EXISTS storage_config (
                user_id TEXT PRIMARY KEY,
                provider TEXT NOT NULL,
                bucket TEXT NOT NULL,
                endpoint TEXT NOT NULL,
                region TEXT NOT NULL,
                access_key_id TEXT NOT NULL,
                secret_access_key TEXT NOT NULL,
                public_url TEXT,
                updated_at BIGINT
            );
        `;

        // --- GET CONFIG ---
        if (req.method === 'GET') {
            const { rows } = await sql`SELECT * FROM storage_config WHERE user_id = ${user.id}`;
            
            if (rows.length === 0) {
                return res.status(200).json(null); // No config yet
            }

            const config = rows[0];
            
            // SECURITY: Never return the full secret key to the frontend
            // We return a mask to indicate it is set.
            return res.status(200).json({
                provider: config.provider,
                bucket: config.bucket,
                endpoint: config.endpoint,
                region: config.region,
                accessKeyId: config.access_key_id,
                secretAccessKey: '********', // Masked
                publicUrl: config.public_url,
                isActive: true
            });
        }

        // --- SAVE CONFIG ---
        if (req.method === 'POST') {
            const { provider, bucket, endpoint, region, accessKeyId, secretAccessKey, publicUrl } = req.body;

            // Basic validation
            if (!provider || !bucket || !endpoint || !accessKeyId) {
                return res.status(400).json({ error: "Missing required fields" });
            }

            let encryptedSecret = null;

            // If user sent "********", it means they didn't change the key.
            // We need to fetch the existing one or keep it as is.
            if (secretAccessKey && !secretAccessKey.includes('***')) {
                // User provided a NEW key -> Encrypt it
                encryptedSecret = encrypt(secretAccessKey);
            } else {
                // User didn't change key. Fetch existing to ensure we don't overwrite with stars.
                const existing = await sql`SELECT secret_access_key FROM storage_config WHERE user_id = ${user.id}`;
                if (existing.length > 0) {
                    encryptedSecret = existing[0].secret_access_key;
                } else {
                    return res.status(400).json({ error: "Secret Key required for new configuration" });
                }
            }

            await sql`
                INSERT INTO storage_config (user_id, provider, bucket, endpoint, region, access_key_id, secret_access_key, public_url, updated_at)
                VALUES (${user.id}, ${provider}, ${bucket}, ${endpoint}, ${region}, ${accessKeyId}, ${encryptedSecret}, ${publicUrl || ''}, ${Date.now()})
                ON CONFLICT (user_id) 
                DO UPDATE SET 
                    provider = EXCLUDED.provider,
                    bucket = EXCLUDED.bucket,
                    endpoint = EXCLUDED.endpoint,
                    region = EXCLUDED.region,
                    access_key_id = EXCLUDED.access_key_id,
                    secret_access_key = EXCLUDED.secret_access_key,
                    public_url = EXCLUDED.public_url,
                    updated_at = EXCLUDED.updated_at;
            `;

            return res.status(200).json({ success: true });
        }

        return res.status(405).json({ error: "Method not allowed" });

    } catch (error) {
        console.error("Storage Config API Error:", error);
        return res.status(500).json({ error: error.message });
    }
}
