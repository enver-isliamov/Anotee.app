// Типы для api/_orgAccess.js (T-02). Рантайм — ESM JS на Vercel, типы нужны для tsc/vitest.
export declare function isOrgMember(userOrgIds: unknown, targetOrgId: unknown): boolean;
export declare function extractOrgIds(memberships: unknown): string[];
