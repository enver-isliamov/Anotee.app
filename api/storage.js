
import { sql } from '@vercel/postgres';
import { verifyUser } from './_auth.js';
import { encrypt } from './_crypto.js';
import { getS3Client } from './_s3.js';
import { ListObjectsV2Command, HeadBucketCommand, PutObjectCommand, GetObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export default async function handler(req, res) {
    const { action } = req.query;

    try {
        // 1. Common Auth Check
        const user = await verifyUser(req);
        if (!user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        // --- ACTION: CONFIG (GET/POST) ---
        if (action === 'config') {
            // Lazy DB Migration
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

            if (req.method === 'GET') {
                const { rows } = await sql`SELECT * FROM storage_config WHERE user_id = ${user.id}`;
                
                if (rows.length === 0) {
                    return res.status(200).json(null);
                }

                const config = rows[0];
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

            if (req.method === 'POST') {
                const { provider, bucket, endpoint, region, accessKeyId, secretAccessKey, publicUrl } = req.body;

                if (!provider || !bucket || !endpoint || !accessKeyId) {
                    return res.status(400).json({ error: "Missing required fields" });
                }

                let encryptedSecret = null;

                if (secretAccessKey && !secretAccessKey.includes('***')) {
                    encryptedSecret = encrypt(secretAccessKey);
                } else {
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
        }

        // --- ACTION: TEST CONNECTION (POST) ---
        if (action === 'test') {
            if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });

            const { s3, config } = await getS3Client(user.id);
            console.log(`Testing S3 connection for user ${user.id} to ${config.endpoint}`);

            try {
                const command = new HeadBucketCommand({ Bucket: config.bucket });
                await s3.send(command);
            } catch (e) {
                console.warn("HeadBucket failed, trying ListObjects:", e.message);
                const listCmd = new ListObjectsV2Command({ Bucket: config.bucket, MaxKeys: 1 });
                await s3.send(listCmd);
            }

            return res.status(200).json({ 
                success: true, 
                message: "Connection Successful", 
                bucket: config.bucket,
                provider: config.provider 
            });
        }

        // --- ACTION: PRESIGN URL (POST) ---
        if (action === 'presign') {
            if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });

            const { operation, key, contentType } = req.body;

            if (!operation || !key) {
                return res.status(400).json({ error: "Missing operation or key" });
            }

            const { s3, config } = await getS3Client(user.id);
            
            let command;
            let expiresIn = 3600; // 1 hour link validity

            if (operation === 'put') {
                command = new PutObjectCommand({
                    Bucket: config.bucket,
                    Key: key,
                    ContentType: contentType || 'application/octet-stream',
                });
            } else if (operation === 'get') {
                command = new GetObjectCommand({
                    Bucket: config.bucket,
                    Key: key
                });
            } else {
                return res.status(400).json({ error: "Invalid operation" });
            }

            const url = await getSignedUrl(s3, command, { expiresIn });

            return res.status(200).json({ 
                url, 
                key,
                publicUrl: config.public_url 
            });
        }

        // --- ACTION: DELETE OBJECTS (POST) ---
        if (action === 'delete') {
            if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });
            
            const { keys } = req.body;
            if (!keys || !Array.isArray(keys) || keys.length === 0) {
                return res.status(400).json({ error: "No keys provided" });
            }

            const { s3, config } = await getS3Client(user.id);

            const command = new DeleteObjectsCommand({
                Bucket: config.bucket,
                Delete: {
                    Objects: keys.map(k => ({ Key: k })),
                    Quiet: true
                }
            });

            await s3.send(command);
            return res.status(200).json({ success: true });
        }

        // --- ACTION: DELETE FOLDER/PREFIX (POST) ---
        if (action === 'delete_folder') {
            if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });
            
            const { prefix } = req.body;
            if (!prefix) return res.status(400).json({ error: "Prefix required" });

            const { s3, config } = await getS3Client(user.id);

            // 1. List objects to find what to delete
            // Note: Loops if > 1000 objects, implemented simple version for now
            const listCmd = new ListObjectsV2Command({
                Bucket: config.bucket,
                Prefix: prefix
            });

            const listedObjects = await s3.send(listCmd);

            if (!listedObjects.Contents || listedObjects.Contents.length === 0) {
                return res.status(200).json({ success: true, message: "Nothing to delete" });
            }

            // 2. Delete found objects
            const deleteCmd = new DeleteObjectsCommand({
                Bucket: config.bucket,
                Delete: {
                    Objects: listedObjects.Contents.map(({ Key }) => ({ Key })),
                    Quiet: true
                }
            });

            await s3.send(deleteCmd);
            return res.status(200).json({ success: true, count: listedObjects.Contents.length });
        }

        return res.status(400).json({ error: "Invalid action" });

    } catch (error) {
        console.error(`Storage API Error (${action}):`, error);
        
        let msg = error.message;
        if (msg.includes("InvalidAccessKeyId")) msg = "Неверный Access Key ID";
        if (msg.includes("SignatureDoesNotMatch")) msg = "Неверный Secret Key";
        if (msg.includes("NoSuchBucket")) msg = "Бакет с таким именем не найден";
        if (msg.includes("ENOTFOUND") || msg.includes("EAI_AGAIN")) msg = "Неверный Endpoint URL";

        return res.status(500).json({ success: false, error: msg });
    }
}
