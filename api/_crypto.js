import crypto from 'crypto';

// T-03: раньше при отсутствии CLERK_SECRET_KEY использовался предсказуемый фолбэк-ключ,
// а алгоритм был aes-256-cbc без аутентификации. Теперь:
//  - фолбэк запрещён: без мастер-ключа операции падают с явной ошибкой;
//  - новые значения пишутся в AES-256-GCM (префикс v2:);
//  - старые значения (CBC) по-прежнему читаются — обратная совместимость сохранена.

const LEGACY_FALLBACK = 'default-fallback-secret-key-do-not-use-in-prod';
const ALGO_GCM = 'aes-256-gcm';
const ALGO_LEGACY = 'aes-256-cbc';
const GCM_PREFIX = 'v2:';

function getMasterSecret() {
    const secret = process.env.CRYPTO_MASTER_KEY || process.env.CLERK_SECRET_KEY || '';
    if (!secret || secret === LEGACY_FALLBACK || secret.length < 16) {
        throw new Error('Мастер-ключ не настроен: задайте CRYPTO_MASTER_KEY (или CLERK_SECRET_KEY) — шифрование секретов недоступно');
    }
    return secret;
}

function getCipherKey() {
    return crypto.createHash('sha256').update(getMasterSecret()).digest();
}

export function encrypt(text) {
    if (!text) return null;
    const key = getCipherKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGO_GCM, key, iv);
    const encrypted = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return GCM_PREFIX + iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted.toString('hex');
}

function decryptLegacy(text) {
    const parts = text.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encryptedText = Buffer.from(parts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(ALGO_LEGACY, getCipherKey(), iv);
    return Buffer.concat([decipher.update(encryptedText), decipher.final()]).toString();
}

export function decrypt(text) {
    if (!text) return null;
    try {
        if (text.startsWith(GCM_PREFIX)) {
            const [ivHex, tagHex, dataHex] = text.slice(GCM_PREFIX.length).split(':');
            const decipher = crypto.createDecipheriv(ALGO_GCM, getCipherKey(), Buffer.from(ivHex, 'hex'));
            decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
            return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString();
        }
        return decryptLegacy(text);
    } catch (e) {
        console.error('Decryption failed:', e && e.message ? e.message : e);
        return null;
    }
}

export const CRYPTO_FORMAT = { GCM_PREFIX, ALGO_GCM, ALGO_LEGACY, LEGACY_FALLBACK };
