// Типы для api/_crypto.js (T-03).
export declare function encrypt(text: string | null | undefined): string | null;
export declare function decrypt(text: string | null | undefined): string | null;
export declare const CRYPTO_FORMAT: {
    GCM_PREFIX: string;
    ALGO_GCM: string;
    ALGO_LEGACY: string;
    LEGACY_FALLBACK: string;
};
