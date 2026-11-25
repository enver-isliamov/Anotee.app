import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import { encrypt, decrypt, CRYPTO_FORMAT } from '../../api/_crypto.js';

// T-03: новые значения — AES-256-GCM; старые (CBC) читаются; без мастер-ключа — явная ошибка
describe('_crypto (T-03)', () => {
  beforeEach(() => {
    process.env.CRYPTO_MASTER_KEY = 'unit-test-master-key-0123456789';
    delete process.env.CLERK_SECRET_KEY;
  });

  it('roundtrip: encrypt → decrypt возвращает исходный текст', () => {
    const secret = 'AKIAIOSFODNN7EXAMPLE/секрет';
    const enc = encrypt(secret) as string;
    expect(enc.startsWith(CRYPTO_FORMAT.GCM_PREFIX)).toBe(true);
    expect(decrypt(enc)).toBe(secret);
  });

  it('разные вызовы дают разный шифротекст (случайный IV)', () => {
    const a = encrypt('same');
    const b = encrypt('same');
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe('same');
    expect(decrypt(b)).toBe('same');
  });

  it('подделка шифротекста GCM отбрасывается (аутентификация)', () => {
    const enc = encrypt('важное') as string;
    const parts = enc.slice(CRYPTO_FORMAT.GCM_PREFIX.length).split(':');
    const tampered = parts[0] + ':' + parts[1] + ':' + (parts[2].startsWith('00') ? '11' + parts[2].slice(2) : '00' + parts[2].slice(2));
    expect(decrypt(CRYPTO_FORMAT.GCM_PREFIX + tampered)).toBe(null);
  });

  it('читает старые значения в формате AES-256-CBC (обратная совместимость)', () => {
    const master = String(process.env.CRYPTO_MASTER_KEY);
    const key = crypto.createHash('sha256').update(master).digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const legacy = iv.toString('hex') + ':' + Buffer.concat([cipher.update('старый секрет', 'utf8'), cipher.final()]).toString('hex');
    expect(decrypt(legacy)).toBe('старый секрет');
  });

  it('без мастер-ключа encrypt падает, а не шифрует предсказуемым ключом', () => {
    delete process.env.CRYPTO_MASTER_KEY;
    delete process.env.CLERK_SECRET_KEY;
    expect(() => encrypt('x')).toThrow(/Мастер-ключ/);
  });

  it('фолбэк-ключ из прошлого не принимается', () => {
    process.env.CRYPTO_MASTER_KEY = CRYPTO_FORMAT.LEGACY_FALLBACK;
    expect(() => encrypt('x')).toThrow(/Мастер-ключ/);
  });

  it('пустой вход → null', () => {
    expect(encrypt('')).toBe(null);
    expect(decrypt('')).toBe(null);
  });
});
