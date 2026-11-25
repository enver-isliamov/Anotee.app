
import { S3Client } from '@aws-sdk/client-s3';
import { sql } from '@vercel/postgres';
import { decrypt } from './_crypto.js';

/**
 * Creates an authenticated S3 Client for the given user.
 * Fetches config from DB and decrypts credentials.
 */
export async function getS3Client(userId) {
    if (!userId) throw new Error("UserId required for S3 Client");

    // T-361 (production parity): главный источник — storage_config (одна строка user_id, как в проде,
    // где подключение всегда сохранялось). storage_configs — только fallback для старых записей.
    let rows = [];
    try {
        const legacy = await sql`SELECT * FROM storage_config WHERE user_id = ${userId}`;
        rows = legacy.rows;
    } catch (e) {
        console.warn('storage_config read failed, per-provider fallback:', e && e.message ? e.message : e);
    }
    if (rows.length === 0) {
        try {
            const cfgRows = await sql`SELECT * FROM storage_configs WHERE user_id = ${userId} ORDER BY updated_at DESC NULLS LAST`;
            if (cfgRows.length > 0) rows = [cfgRows[0]];
        } catch (e) {
            console.warn('per-provider read failed:', e && e.message ? e.message : e);
        }
    }

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
                // Important for some S3 providers (like MinIO or older R2) to force path style
        forcePathStyle: true,
        // T-31: НЕ добавлять x-amz-checksum-mode в presigned URL — иначе R2 отвечает 403
        // (SignedHeaders включает checksum-заголовок, которого нет в браузерном GET)
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED', 
    });

    return { s3, config };
}
