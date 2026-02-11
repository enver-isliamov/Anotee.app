
import crypto from 'crypto';

// We use the existing CLERK_SECRET_KEY as a master key to avoid new env requirements.
// We derive a 32-byte key from it.
const MASTER_SECRET = process.env.CLERK_SECRET_KEY || 'default-fallback-secret-key-do-not-use-in-prod';
const ALGORITHM = 'aes-256-cbc';

function getCipherKey() {
    return crypto.createHash('sha256').update(MASTER_SECRET).digest();
}

export function encrypt(text) {
    if (!text) return null;
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, getCipherKey(), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(text) {
    if (!text) return null;
    try {
        const textParts = text.split(':');
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, getCipherKey(), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (e) {
        console.error("Decryption failed:", e);
        return null;
    }
}
