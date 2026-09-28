
import { S3Client } from '@aws-sdk/client-s3';
import { sql } from '@vercel/postgres';
import { decrypt } from './_crypto.js';

/**
 * Creates an authenticated S3 Client for the given user.
 * Fetches config from DB and decrypts credentials.
 */
export async function getS3Client(userId) {
    if (!userId) throw new Error("UserId required for S3 Client");

    // T-322: сначала пробуем per-provider конфиг активного провайдера (storage_configs),
    // legacy storage_config — только как fallback. Раньше «Сохранить» без «активации»
    // оставляло legacy пустым и «Проверить» падало с «S3 Configuration not found».
    let rows = [];
    try {
        const prefRows = await sql`SELECT active_provider FROM storage_prefs WHERE user_id = ${userId}`;
        const active = prefRows.length > 0 ? prefRows[0].active_provider : null;
        const cfgRows = await sql`SELECT * FROM storage_configs WHERE user_id = ${userId}`;
        if (cfgRows.length > 0) {
            const chosen = (active && cfgRows.find(r => r.provider === active)) || cfgRows[0];
            rows = [chosen];
        }
    } catch (e) {
        // таблица storage_configs может быть недоступна — идём в legacy
        console.warn('per-provider read failed, legacy fallback:', e && e.message ? e.message : e);
    }

    if (rows.length === 0) {
        const legacy = await sql`SELECT * FROM storage_config WHERE user_id = ${userId}`;
        rows = legacy.rows;
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
