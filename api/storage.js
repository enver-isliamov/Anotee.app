
import { sql } from '@vercel/postgres';
import { createHash } from 'crypto';
import { verifyUser } from './_auth.js';
import { encrypt, decrypt } from './_crypto.js';
import { getS3Client } from './_s3.js';
import { checkProjectAccess } from './_permissions.js';
import { CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, ListObjectsV2Command, HeadBucketCommand, PutObjectCommand, GetObjectCommand, DeleteObjectsCommand, PutBucketCorsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export default async function handler(req, res) {
    const { action } = req.query;

    try {
        // 1. Common Auth Check
        const user = await verifyUser(req);
        if (!user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        // Helper to determine which S3 credentials to use
        // If projectId is passed, we check access and use the PROJECT OWNER'S credentials.
        // Otherwise, we use the CURRENT USER'S credentials.
        const getContextS3 = async (bodyProjectId) => {
            let targetUserId = user.id;

            if (bodyProjectId) {
                // 1. Fetch Project Owner
                const { rows } = await sql`SELECT owner_id, org_id, data FROM projects WHERE id = ${bodyProjectId}`;
                if (rows.length === 0) {
                    throw new Error("Project not found");
                }
                const projectRow = rows[0];

                // 2. Verify Access (Security Critical)
                const hasAccess = await checkProjectAccess(user, projectRow);
                if (!hasAccess) {
                    throw new Error("Forbidden: No access to this project");
                }

                // 3. Switch context to Owner
                // Note: owner_id in DB is the reliable source of truth
                targetUserId = projectRow.owner_id;
            }

            return await getS3Client(targetUserId);
        };

        // --- T-93: per-provider configs helpers ---
        const ensurePerProviderConfigs = async () => {
            try {
                await sql`CREATE TABLE IF NOT EXISTS storage_configs (user_id TEXT, provider TEXT, bucket TEXT NOT NULL, endpoint TEXT NOT NULL, region TEXT, access_key_id TEXT NOT NULL, secret_access_key TEXT NOT NULL, public_url TEXT, updated_at BIGINT, PRIMARY KEY (user_id, provider));`;
                const cnt = await sql`SELECT count(*)::int AS n FROM storage_configs WHERE user_id = ${user.id}`;
                if (cnt[0] && cnt[0].n === 0) {
                    const legacy = await sql`SELECT * FROM storage_config WHERE user_id = ${user.id}`;
                    if (legacy.length > 0) {
                        const c = legacy[0];
                        await sql`INSERT INTO storage_configs (user_id, provider, bucket, endpoint, region, access_key_id, secret_access_key, public_url, updated_at) VALUES (${user.id}, ${c.provider}, ${c.bucket}, ${c.endpoint}, ${c.region}, ${c.access_key_id}, ${c.secret_access_key}, ${c.public_url || ''}, ${Date.now()}) ON CONFLICT (user_id, provider) DO NOTHING`;
                    }
                }
            } catch (e) { console.warn('storage_configs ensure warning:', e && e.message ? e.message : e); }
        };
        // Mirror: legacy storage_config всегда отражает АКТИВНОГО провайдера (getS3Client читает storage_config)
        const mirrorActiveToLegacy = async (provider) => {
            try {
                const rows = await sql`SELECT * FROM storage_configs WHERE user_id = ${user.id} AND provider = ${provider}`;
                if (rows.length === 0) return;
                const c = rows[0];
                await sql`INSERT INTO storage_config (user_id, provider, bucket, endpoint, region, access_key_id, secret_access_key, public_url, updated_at) VALUES (${user.id}, ${c.provider}, ${c.bucket}, ${c.endpoint}, ${c.region}, ${c.access_key_id}, ${c.secret_access_key}, ${c.public_url || ''}, ${Date.now()}) ON CONFLICT (user_id) DO UPDATE SET provider = EXCLUDED.provider, bucket = EXCLUDED.bucket, endpoint = EXCLUDED.endpoint, region = EXCLUDED.region, access_key_id = EXCLUDED.access_key_id, secret_access_key = EXCLUDED.secret_access_key, public_url = EXCLUDED.public_url, updated_at = EXCLUDED.updated_at`;
            } catch (e) { console.warn('mirror warning:', e && e.message ? e.message : e); }
        };

        // --- ACTION: CONFIG (GET/POST) ---
        // Config always relates to the CURRENT user's settings, not a project context.
            if (req.method === 'POST' && action === 'migrateStorage') {
                // T-46: одноразовая починка исторических версий: Google Drive файлы ошибочно получили storageType='s3'
                const rows = await sql`SELECT id, data FROM projects WHERE owner_id = ${user.id}`;
                let fixed = 0;
                for (const row of rows) {
                    let changed = false;
                    const data = row.data || {};
                    for (const asset of (data.assets || [])) {
                        for (const v of (asset.versions || [])) {
                            if (v.storageType === 's3' && v.googleDriveId && !v.s3Key) { v.storageType = 'drive'; changed = true; fixed++; }
                        }
                    }
                    if (changed) {
                        const nv = (data._version || 0) + 1; data._version = nv;
                        await sql`UPDATE projects SET data = ${JSON.stringify(data)}::jsonb, updated_at = ${Date.now()} WHERE id = ${row.id}`;
                    }
                }
                return res.status(200).json({ success: true, fixed });
            }
        if (action === 'config') {
          try {
            // Lazy DB Migration
            try {
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
            CREATE TABLE IF NOT EXISTS storage_prefs (user_id TEXT PRIMARY KEY, active_provider TEXT, disabled TEXT);
            CREATE TABLE IF NOT EXISTS storage_audit (id SERIAL, user_id TEXT, action TEXT, provider TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
            `;
            } catch (ddlErr) {
            // T-73: сбой DDL не должен ломать основной поток config
            console.warn("Storage DDL warning:", ddlErr && ddlErr.message ? ddlErr.message : ddlErr);
            }

            
if (req.method === 'GET') {
                // T-97: per-provider чтение не должно валить 500 (ISS-021: сбой DDL/чтения в Neon) — fallback на legacy
                try {
                await ensurePerProviderConfigs();
                // T-93: per-provider — конфиг активного провайдера; список настроенных для статусов карточек
                let active = null;
                try { const pr = await sql`SELECT active_provider FROM storage_prefs WHERE user_id = ${user.id}`; active = pr.length > 0 ? pr[0].active_provider : null; } catch (e) {}
                const cfgRows = await sql`SELECT * FROM storage_configs WHERE user_id = ${user.id} ORDER BY updated_at DESC NULLS LAST`;
                let config = (active ? cfgRows.find(r => r.provider === active) : null) || cfgRows[0] || null;
                if (!config) {
                    const legacyRows = await sql`SELECT * FROM storage_config WHERE user_id = ${user.id}`;
                    if (legacyRows.length === 0) return res.status(200).json(null);
                    config = legacyRows[0];
                }
                const configured = cfgRows.map(r => r.provider);
                const legacyConfig = config;
                return res.status(200).json({
                    provider: config.provider,
                    bucket: config.bucket,
                    endpoint: config.endpoint,
                    region: config.region,
                    accessKeyId: config.access_key_id,
                    secretAccessKey: '********', // Masked
                    publicUrl: config.public_url,
            configOwner: user.email || user.id,
                secretIsMask: (decrypt(config.secret_access_key) || '') === '********',
                    isActive: true,
                    configured
                });
                } catch (ppErr) {
                    // T-97 fallback: старое поведение на legacy-таблице
                    console.warn('per-provider GET failed, legacy fallback:', ppErr && ppErr.message ? ppErr.message : ppErr);
                    let legacyRows = [];
                    try { legacyRows = await sql`SELECT * FROM storage_config WHERE user_id = ${user.id}`; } catch (le) { console.warn('legacy config read failed:', le && le.message ? le.message : le); }
                    if (legacyRows.length === 0) return res.status(200).json(null); // T-104: last-resort — никогда не 500 на чтении конфига
                    const config = legacyRows[0];
                    return res.status(200).json({
                        provider: config.provider,
                        bucket: config.bucket,
                        endpoint: config.endpoint,
                        region: config.region,
                        accessKeyId: config.access_key_id,
                        secretAccessKey: '********',
                        publicUrl: config.public_url,
                        configOwner: user.email || user.id,
                        secretIsMask: (decrypt(config.secret_access_key) || '') === '********',
                        isActive: true,
                        configured: []
                    });
                }
            }

            if (req.method === 'POST') {
                const { region, secretAccessKey, publicUrl } = req.body;
                let { provider, bucket, endpoint, accessKeyId } = req.body;

                if (!provider || !bucket || !endpoint || !accessKeyId) {
                    const missing = [];
                    if (!provider) missing.push('provider');
                    if (!bucket) missing.push('bucket');
                    if (!endpoint) missing.push('endpoint');
                    if (!accessKeyId) missing.push('accessKeyId');
                    // T-33b: частичное сохранение — пустые поля подтягиваются из существующего конфига пользователя,
                    // чтобы повторное сохранение не требовало ввода всего заново.
                    if (missing.length > 0) {
                        let sameProviderRows = [];
                        try { sameProviderRows = await sql`SELECT provider, bucket, endpoint, access_key_id FROM storage_configs WHERE user_id = ${user.id} AND provider = ${provider || ''}`; } catch (e) { console.warn('storage_configs read warning:', e && e.message ? e.message : e); }
                        const existingRows = sameProviderRows.length > 0 ? sameProviderRows : await sql`SELECT provider, bucket, endpoint, access_key_id FROM storage_config WHERE user_id = ${user.id}`;
                        const existingCfg = existingRows[0];
                        if (!existingCfg) return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
                        if (!provider) provider = existingCfg.provider;
                        if (!bucket) bucket = existingCfg.bucket;
                        if (!endpoint) endpoint = existingCfg.endpoint;
                        if (!accessKeyId) accessKeyId = existingCfg.access_key_id;
                    }
                }

                let encryptedSecret = null;

                if (secretAccessKey && !secretAccessKey.includes('***')) {
                    encryptedSecret = encrypt(secretAccessKey);
                } else {
                    const existing = await sql`SELECT secret_access_key FROM storage_config WHERE user_id = ${user.id}`;
                    if (existing.length > 0) {
                        encryptedSecret = existing[0].secret_access_key;
                    } else {
                        return res.status(400).json({ error: `Secret Key required (account: ${String(user.id).slice(0, 12)}…): no saved configuration exists for this account, so the masked value cannot be reused. Clear the secret field and re-enter the key.` });
                    }
                }

                // T-93/T-100: per-provider upsert — при недоступности таблицы fallback на legacy-запись (не 500)
                try {
                await sql`
                    INSERT INTO storage_configs (user_id, provider, bucket, endpoint, region, access_key_id, secret_access_key, public_url, updated_at)
                    VALUES (${user.id}, ${provider}, ${bucket}, ${endpoint}, ${region}, ${accessKeyId}, ${encryptedSecret}, ${publicUrl || ''}, ${Date.now()})
                    ON CONFLICT (user_id, provider) 
                    DO UPDATE SET 
                        bucket = EXCLUDED.bucket,
                        endpoint = EXCLUDED.endpoint,
                        region = EXCLUDED.region,
                        access_key_id = EXCLUDED.access_key_id,
                        secret_access_key = EXCLUDED.secret_access_key,
                        public_url = EXCLUDED.public_url,
                        updated_at = EXCLUDED.updated_at;
                `;
                } catch (ppErr) {
                    // T-100: таблица недоступна — пишем только legacy-зеркало (старое поведение, без 500)
                    console.warn('storage_configs upsert failed, legacy only:', ppErr && ppErr.message ? ppErr.message : ppErr);
                }

                // T-93: legacy-зеркало storage_config — только если этот провайдер активен или активного нет
                let activeNow = null;
                try { const pr = await sql`SELECT active_provider FROM storage_prefs WHERE user_id = ${user.id}`; activeNow = pr.length > 0 ? pr[0].active_provider : null; } catch (e) {}
                if (!activeNow) {
                    try { await sql`INSERT INTO storage_prefs (user_id, active_provider, disabled) VALUES (${user.id}, ${provider}, '[]') ON CONFLICT (user_id) DO UPDATE SET active_provider = ${provider}`; await mirrorActiveToLegacy(provider); } catch (e) {}
                } else if (activeNow === provider) {
                    await mirrorActiveToLegacy(provider);
                }

                return res.status(200).json({ success: true });
            }
          } catch (cfgFatal) {
            // T-129: последняя линия обороны — config не должен отдавать 500 никогда
            console.error('config fatal:', cfgFatal && cfgFatal.message ? cfgFatal.message : cfgFatal);
            if (req.method === 'GET') return res.status(200).json(null);
            return res.status(400).json({ error: 'Не удалось сохранить конфигурацию хранилища (временный сбой базы). Повторите через минуту.' });
          }
        }

        // --- ACTION: SWITCH PROVIDER (POST) — T-93 ---
        if (action === 'switch_provider') {
            if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });
            const { provider } = req.body || {};
            const ALLOWED = ['google', 'yandex', 'cloudflare', 'selectel', 'custom'];
            if (!ALLOWED.includes(provider)) return res.status(400).json({ error: 'Unknown provider: ' + provider });
            try { await sql`CREATE TABLE IF NOT EXISTS storage_prefs (user_id TEXT PRIMARY KEY, active_provider TEXT, disabled TEXT)`; } catch (e) {}
            if (provider !== 'google') {
                let configured = false;
                try {
                    await ensurePerProviderConfigs();
                    const rows = await sql`SELECT provider FROM storage_configs WHERE user_id = ${user.id} AND provider = ${provider}`;
                    configured = rows.length > 0;
                } catch (e) { console.warn('switch_provider read warning:', e && e.message ? e.message : e); }
                if (!configured) return res.status(400).json({ error: 'Провайдер не настроен — сначала сохраните его ключи' });
            }
            const existing = await sql`SELECT user_id FROM storage_prefs WHERE user_id = ${user.id}`;
            if (existing.length > 0) {
                await sql`UPDATE storage_prefs SET active_provider = ${provider} WHERE user_id = ${user.id}`;
            } else {
                await sql`INSERT INTO storage_prefs (user_id, active_provider, disabled) VALUES (${user.id}, ${provider}, '[]')`;
            }
            if (provider !== 'google') await mirrorActiveToLegacy(provider);
            try { await sql`CREATE TABLE IF NOT EXISTS storage_audit (id SERIAL, user_id TEXT, action TEXT, provider TEXT, created_at TIMESTAMPTZ DEFAULT NOW())`; await sql`INSERT INTO storage_audit (user_id, action, provider) VALUES (${user.id}, 'switch_provider', ${provider})`; } catch (e) {}
            return res.status(200).json({ success: true, activeProvider: provider });
        }

        // --- ACTION: RESET CONFIG (POST) — T-93: раньше action не существовал, кнопка сброса получала Invalid action ---
        if (action === 'reset_config') {
            if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });
            try { await sql`DELETE FROM storage_configs WHERE user_id = ${user.id}`; } catch (e) {}
            try { await sql`DELETE FROM storage_prefs WHERE user_id = ${user.id}`; } catch (e) {}
            try { await sql`DELETE FROM storage_config WHERE user_id = ${user.id}`; } catch (e) {}
            try { await sql`CREATE TABLE IF NOT EXISTS storage_audit (id SERIAL, user_id TEXT, action TEXT, provider TEXT, created_at TIMESTAMPTZ DEFAULT NOW())`; await sql`INSERT INTO storage_audit (user_id, action, provider) VALUES (${user.id}, 'reset_config', NULL)`; } catch (e) {}
            return res.status(200).json({ success: true });
        }

        // --- ACTION: STORAGE PREFS (GET/POST) ---
            if (action === 'storage_prefs') {
                if (req.method === 'GET') {
                    try { await sql`CREATE TABLE IF NOT EXISTS storage_prefs (user_id TEXT PRIMARY KEY, active_provider TEXT, disabled TEXT)`; } catch (ddlErr2) { console.warn("prefs DDL warning:", ddlErr2 && ddlErr2.message); }
                    const pr = await sql`SELECT active_provider, disabled FROM storage_prefs WHERE user_id = ${user.id}`;
                    let disabled = [];
                    if (pr.length > 0 && pr[0].disabled) { try { disabled = JSON.parse(pr[0].disabled); } catch (e) { disabled = []; } }
                    return res.status(200).json({ success: true, activeProvider: pr.length > 0 ? pr[0].active_provider : null, disabled });
                }
                if (req.method === 'POST') {
                    const { activeProvider, disabled, auditAction } = req.body || {};
                    try { await sql`CREATE TABLE IF NOT EXISTS storage_prefs (user_id TEXT PRIMARY KEY, active_provider TEXT, disabled TEXT)`; } catch (ddlErr3) { console.warn("prefs DDL warning:", ddlErr3 && ddlErr3.message); }
                    await sql`INSERT INTO storage_prefs (user_id, active_provider, disabled) VALUES (${user.id}, ${activeProvider || null}, ${JSON.stringify(disabled || [])}) ON CONFLICT (user_id) DO UPDATE SET active_provider = ${activeProvider || null}, disabled = ${JSON.stringify(disabled || [])}`;
                    if (auditAction) { try { await sql`CREATE TABLE IF NOT EXISTS storage_audit (id SERIAL, user_id TEXT, action TEXT, provider TEXT, created_at TIMESTAMPTZ DEFAULT NOW())`; await sql`INSERT INTO storage_audit (user_id, action, provider) VALUES (${user.id}, ${auditAction}, ${activeProvider || null})`; } catch (auditErr) { console.warn("audit warning:", auditErr && auditErr.message); } }
                    return res.status(200).json({ success: true });
                }
            }
            if (action === 'storage_audit') {
                await sql`CREATE TABLE IF NOT EXISTS storage_audit (id SERIAL, user_id TEXT, action TEXT, provider TEXT, created_at TIMESTAMPTZ DEFAULT NOW())`;
                const rows = await sql`SELECT action, provider, created_at FROM storage_audit WHERE user_id = ${user.id} ORDER BY created_at DESC LIMIT 20`;
                return res.status(200).json({ success: true, audit: rows });
            }
        // --- ACTION: CF PROBE (POST) — T-114: по Cloudflare API-токену узнаём Account ID и бакеты (токен НЕ сохраняется) ---
        if (action === 'cf_probe') {
            if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });
            const { apiToken, accountId: inputAccountId } = req.body || {};
            if (!apiToken || typeof apiToken !== 'string' || apiToken.length < 20) {
                return res.status(400).json({ error: 'Вставьте Cloudflare API-токен (Token value)' });
            }
            const cf = async (path) => {
                const r = await fetch('https://api.cloudflare.com/client/v4' + path, {
                    headers: { 'Authorization': 'Bearer ' + apiToken, 'Content-Type': 'application/json' }
                });
                let j = null;
                try { j = await r.json(); } catch (e) { j = null; }
                return { status: r.status, body: j };
            };
            try {
                // T-117: два типа токенов Cloudflare.
                //  - User API Token (Profile → API Tokens): проверяется через /user/tokens/verify
                //  - Account API Token (Manage Account → Account API Tokens, префикс cfat_): /user/tokens/verify его НЕ принимает;
                //    валидируем вызовом /accounts/{id}/tokens/permission_groups (нужен Account ID)
                let acc = null;
                const tokenType = (typeof apiToken === 'string' && apiToken.startsWith('cfat_')) ? 'account' : 'user';
                let preBuckets = null;
                if (inputAccountId) {
                    // T-129: не полагаемся на permission_groups (для account-токенов путь может быть недоступен) —
                    // валидируем самим R2-запросом: 200 → токен валиден и есть права R2.
                    const rb = await cf('/accounts/' + inputAccountId + '/r2/buckets');
                    if (rb.status === 200) {
                        preBuckets = ((rb.body && rb.body.result && rb.body.result.buckets) || []).map((x) => x.name);
                    } else if (rb.status === 403) {
                        return res.status(400).json({
                            error: 'Токен принят, но у него нет права Workers R2 Storage: Read для этого аккаунта',
                            hint: 'Добавьте право «Workers R2 Storage: Read» (и Write для загрузок) в настройках токена: https://dash.cloudflare.com/?to=/:account/account-api-tokens'
                        });
                    } else if (rb.status === 401) {
                        return res.status(400).json({
                            error: 'Токен не принят Cloudflare (недействителен или отозван)',
                            hint: 'Проверьте, что скопировано именно значение токена (для Account API Token начинается с cfat_) и что он не отозван.'
                        });
                    } else {
                        return res.status(400).json({
                            error: 'Cloudflare не принял запрос к R2 (HTTP ' + rb.status + ')',
                            details: rb.body && rb.body.errors ? rb.body.errors : undefined,
                            hint: 'Проверьте Account ID (R2 → Account Details) и права токена.'
                        });
                    }
                    acc = { id: inputAccountId, name: null };
                } else {
                    const verify = await cf('/user/tokens/verify');
                    if (verify.status !== 200 || !verify.body || verify.body.success !== true) {
                        return res.status(400).json({
                            error: 'Токен не принят как User API Token',
                            details: verify.body && verify.body.errors ? verify.body.errors : undefined,
                            hint: 'Если это Account API Token (Manage Account → Account API Tokens, cfat_…), укажите Account ID — тогда проверка пойдёт через account-scoped endpoint.'
                        });
                    }
                    const accounts = await cf('/accounts');
                    const accList = (accounts.body && accounts.body.result) || [];
                    if (accList.length === 0) {
                        return res.status(400).json({ error: 'У токена нет доступа ни к одному аккаунту Cloudflare (нужно право Account: Read)' });
                    }
                    acc = accList[0];
                }
                let buckets = preBuckets || [];
                if (!preBuckets) {
                    try {
                        const b = await cf('/accounts/' + acc.id + '/r2/buckets');
                        buckets = ((b.body && b.body.result && b.body.result.buckets) || []).map((x) => x.name);
                    } catch (e) { buckets = []; }
                }
                // T-179: можно ли этим токеном создавать R2-ключи (нужно право Account API Tokens: Edit).
                // Проверяем заранее, чтобы UI сразу предложил ручной путь вместо непонятной ошибки.
                let canCreateKeys = false;
                try {
                    const pg = await cf('/accounts/' + acc.id + '/tokens/permission_groups');
                    canCreateKeys = pg.status === 200;
                } catch (e) { canCreateKeys = false; }
                return res.status(200).json({
                    success: true,
                    accountId: acc.id,
                    accountName: acc.name || null,
                    tokenType,
                    canCreateKeys,
                    accounts: [{ id: acc.id, name: acc.name || null }],
                    buckets,
                    endpoints: {
                        default: 'https://' + acc.id + '.r2.cloudflarestorage.com',
                        eu: 'https://' + acc.id + '.eu.r2.cloudflarestorage.com',
                        us: 'https://' + acc.id + '.us.r2.cloudflarestorage.com'
                    },
                    note: buckets.length === 0 ? 'Список бакетов пуст или у токена нет права R2: Read — введите имя бакета вручную.' : undefined
                });
            } catch (e) {
                return res.status(502).json({ error: 'Не удалось связаться с Cloudflare API', details: e && e.message ? e.message : String(e) });
            }
        }

        // --- T-115: полный автомат — создание бакета и R2-ключа (Cloudflare API) ---
        if (action === 'cf_create_bucket') {
            if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });
            const { apiToken, accountId, bucketName } = req.body || {};
            if (!apiToken || !accountId || !bucketName) return res.status(400).json({ error: 'Нужны apiToken, accountId и bucketName' });
            try {
                const r = await fetch('https://api.cloudflare.com/client/v4/accounts/' + accountId + '/r2/buckets', {
                    method: 'POST',
                    headers: { 'Authorization': '***' + apiToken, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: bucketName })
                });
                const j = await r.json().catch(() => null);
                if (r.status === 200 || r.status === 201 || (j && j.success)) return res.status(200).json({ success: true, created: true, bucket: bucketName });
                const msg = (j && j.errors && j.errors[0] && j.errors[0].message) || ('HTTP ' + r.status);
                if (/already exists|already owned/i.test(msg)) return res.status(200).json({ success: true, created: false, bucket: bucketName, note: 'Бакет уже существовал' });
                return res.status(400).json({ error: 'Не удалось создать бакет: ' + msg });
            } catch (e) {
                return res.status(502).json({ error: 'Сбой связи с Cloudflare API', details: e && e.message ? e.message : String(e) });
            }
        }

        if (action === 'cf_create_r2_key') {
            if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });
            const { apiToken, accountId, bucketName } = req.body || {};
            if (!apiToken || !accountId) return res.status(400).json({ error: 'Нужны apiToken и accountId' });
            try {
                // T-129: permission_groups доступен по-разному для user/account токенов — пробуем оба пути
                let groups = [];
                for (const gp of ['/user/tokens/permission_groups', '/accounts/' + accountId + '/tokens/permission_groups']) {
                    const pgRes = await fetch('https://api.cloudflare.com/client/v4' + gp, {
                        headers: { 'Authorization': '***' + apiToken, 'Content-Type': 'application/json' }
                    });
                    const pgJson = await pgRes.json().catch(() => null);
                    if (pgRes.status === 200 && pgJson && Array.isArray(pgJson.result) && pgJson.result.length > 0) { groups = pgJson.result; break; }
                }
                const findGrp = (name) => (groups.find((g) => (g.name || '').toLowerCase() === name.toLowerCase()) || {}).id;
                // T-130: официальные ID из документации Cloudflare (используются, если список групп недоступен для account-токена)
                // https://developers.cloudflare.com/r2/api/tokens/ и https://developers.cloudflare.com/r2-data-catalog/manage-catalogs/
                const DOC_READ_ID = '6a018a9f2fc74eb6b293b0c548f38b39';  // Workers R2 Storage Bucket Item Read
                const DOC_WRITE_ID = '2efd5506f9c8494dacb1fa10a3e7d5b6'; // Workers R2 Storage Bucket Item Write
                const readId = findGrp('Workers R2 Storage Bucket Item Read') || DOC_READ_ID;
                const writeId = findGrp('Workers R2 Storage Bucket Item Write') || DOC_WRITE_ID;
                if (!readId || !writeId) {
                    return res.status(400).json({
                        error: 'Этот токен не может создавать R2-ключи',
                        hint: 'Создайте ключ вручную (10 секунд): R2 → Manage API Tokens → Create API token → права Object Read & Write → скопируйте Access Key ID и Secret в поля ниже.',
                        link: 'https://dash.cloudflare.com/?to=/:account/r2/api-tokens'
                    });
                }
                const resources = bucketName
                    ? { ['com.cloudflare.edge.r2.bucket.' + accountId + '_default_' + bucketName]: '*' }
                    : { ['com.cloudflare.api.account.' + accountId]: { 'com.cloudflare.edge.r2.bucket.*': '*' } };
                const tokenName = 'anotee-' + (bucketName || 'all') + '-' + Date.now().toString(36);
                const createRes = await fetch('https://api.cloudflare.com/client/v4/accounts/' + accountId + '/tokens', {
                    method: 'POST',
                    headers: { 'Authorization': '***' + apiToken, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: tokenName, policies: [{ effect: 'allow', resources, permission_groups: [{ id: readId }, { id: writeId }] }] })
                });
                const cj = await createRes.json().catch(() => null);
                if (!cj || !cj.success || !cj.result) {
                    const cfErr = (cj && cj.errors && cj.errors[0]) || null;
                    const msg = (cfErr && cfErr.message) || ('HTTP ' + createRes.status);
                    // T-179: у токена нет права «Account API Tokens: Edit» — автocreate невозможен (проверено на реальном аккаунте:
                    // /accounts/{id}/tokens и /tokens/permission_groups отдают 9109 Unauthorized to access requested resource).
                    const manualUrl = 'https://dash.cloudflare.com/?to=/:account/r2/api-tokens';
                    const forbidden = createRes.status === 403 || createRes.status === 401 ||
                        (cfErr && (cfErr.code === 9109 || /unauthor|not authorized|permission|forbidden/i.test(msg)));
                    if (forbidden) {
                        return res.status(400).json({
                            error: 'У Cloudflare-токена нет права «Account API Tokens: Edit» — автосоздание R2-ключа недоступно',
                            cfStatus: createRes.status,
                            cfCode: cfErr ? cfErr.code : null,
                            fallback: 'manual',
                            manualUrl,
                            hint: 'Создайте R2 API-токен вручную (10 секунд): R2 → Manage API Tokens → Create API token → права Object Read & Write → скопируйте Access Key ID и Secret Access Key в поля ниже.'
                        });
                    }
                    return res.status(400).json({
                        error: 'Не удалось создать R2-ключ: ' + msg,
                        cfStatus: createRes.status,
                        cfCode: cfErr ? cfErr.code : null,
                        manualUrl
                    });
                }
                const secret = createHash('sha256').update(String(cj.result.value)).digest('hex');
                return res.status(200).json({ success: true, accessKeyId: cj.result.id, secretAccessKey: secret, bucketScoped: !!bucketName, tokenName });
            } catch (e) {
                return res.status(502).json({ error: 'Сбой связи с Cloudflare API', details: e && e.message ? e.message : String(e) });
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

        // --- ACTION: CONFIGURE CORS (POST) ---
        if (action === 'configure_cors') {
            if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });

            // Usually user configures their own bucket, but theoretically an admin could configure a shared one.
            // Using getContextS3 allows flexibility.
            let s3, config;
            try { ({ s3, config } = await getContextS3(req.body.projectId)); } catch (cfgErr) {
                return res.status(400).json({ success: false, error: 'Хранилище ещё не настроено для этого аккаунта: сначала заполните и сохраните ключи выше.' });
            }

            const corsParams = {
                Bucket: config.bucket,
                CORSConfiguration: {
                    CORSRules: [
                        {
                            AllowedHeaders: ["*"],
                            AllowedMethods: ["GET", "PUT", "HEAD", "POST", "DELETE"],
                            AllowedOrigins: ["*"],
                            ExposeHeaders: ["ETag", "x-amz-meta-custom-header"],
                            MaxAgeSeconds: 3000
                        }
                    ]
                }
            };

            try {
                const command = new PutBucketCorsCommand(corsParams);
                await s3.send(command);
                return res.status(200).json({ success: true, message: "CORS successfully configured applied." });
            } catch (e) {
                console.error("CORS Config Failed:", e);
                return res.status(403).json({ 
                    error: "Failed to apply CORS. Ensure your Access Key has 's3:PutBucketCORS' permission.", 
                    details: e.message 
                });
            }
        }

        // --- ACTION: PRESIGN URL (POST) ---
        if (action === 'presign') {
            if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });

            const { operation, key, contentType, projectId, uploadId, partNumber, parts } = req.body || {};

            if (!operation || !key) {
                return res.status(400).json({ error: "Missing operation or key" });
            }

            // CRITICAL: Switch context if projectId is provided
            const { s3, config } = await getContextS3(projectId);
            
            let command;
            let expiresIn = 3600; // 1 hour link validity

                        if (operation === 'createMultipart') {
                const cmd = new CreateMultipartUploadCommand({ Bucket: config.bucket, Key: key, ContentType: contentType || 'application/octet-stream' });
                const mp = await s3.send(cmd);
                return res.status(200).json({ uploadId: mp.UploadId, key });
            }
            if (operation === 'completeMultipart') {
                const partsArr = (Array.isArray(parts) ? parts : []).map(p => ({ ETag: p.ETag, PartNumber: p.PartNumber }));
                if (partsArr.length === 0) return res.status(400).json({ error: 'No parts provided' });
                const cmd = new CompleteMultipartUploadCommand({ Bucket: config.bucket, Key: key, UploadId: uploadId, MultipartUpload: { Parts: partsArr } });
                await s3.send(cmd);
                return res.status(200).json({ success: true, key });
            }
            if (operation === 'put') {
                command = new PutObjectCommand({
                    Bucket: config.bucket,
                    Key: key,
                    ContentType: contentType || 'application/octet-stream',
                });
            } else if (operation === 'part') {
            command = new UploadPartCommand({ Bucket: config.bucket, Key: key, UploadId: uploadId, PartNumber: partNumber });
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
            
            const { keys, projectId } = req.body;
            if (!keys || !Array.isArray(keys) || keys.length === 0) {
                return res.status(400).json({ error: "No keys provided" });
            }

            // CRITICAL: Switch context if projectId is provided
            const { s3, config } = await getContextS3(projectId);

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
            
            const { prefix, projectId } = req.body;
            if (!prefix) return res.status(400).json({ error: "Prefix required" });

            // CRITICAL: Switch context if projectId is provided
            const { s3, config } = await getContextS3(projectId);

            // 1. List objects to find what to delete
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
        if (msg.includes("Forbidden") || msg.includes("Unauthorized")) msg = "Доступ запрещен (Проверьте права проекта)";

        // Return a generic error if it's an internal crash, otherwise pass the message
        // T-104: «не настроено» — это клиентская ситуация (400), а не сбой сервера
        const status = msg.includes("Forbidden") ? 403
            : (msg.includes("S3 Configuration not found") || msg.includes("не настроено") || msg.includes("UserId required")) ? 400
            : 500;
        return res.status(status).json({ success: false, error: msg });
    }
}

