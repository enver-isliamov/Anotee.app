
import { S3Client } from '@aws-sdk/client-s3';
import { sql } from '@vercel/postgres';
import { decrypt } from './_crypto.js';

/**
 * Creates an authenticated S3 Client for the given user.
 * Fetches config from DB and decrypts credentials.
 */
export async function getS3Client(userId) {
    if (!userId) throw new Error("UserId required for S3 Client");

    const { rows } = await sql`SELECT * FROM storage_config WHERE user_id = ${userId}`;
    
    if (rows.length === 0) {
        throw new Error("S3 Configuration not found for this user");
    }

    const config = rows[0];
    const secretKey = decrypt(config.secret_access_key);

    if (!secretKey) {
        throw new Error("Failed to decrypt S3 credentials");
    }

    // Initialize S3 Client
    const s3 = new S3Client({
        region: config.region || 'us-east-1',
        endpoint: config.endpoint,
        credentials: {
            accessKeyId: config.access_key_id,
            secretAccessKey: secretKey,
        },
        // Important for some S3 providers (like MinIO or older R2) to force path style
        forcePathStyle: true 
    });

    return { s3, config };
}
