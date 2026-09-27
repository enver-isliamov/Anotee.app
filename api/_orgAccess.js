/**
 * T-02: проверка членства в организации для ORG LIST в api/data.js.
 * Чистые функции без зависимостей — покрыты unit-тестами (tests/unit/orgAccess.test.ts).
 */

/** Входит ли запрошенная организация в список организаций пользователя. Fail-closed. */
export function isOrgMember(userOrgIds, targetOrgId) {
    if (!targetOrgId || typeof targetOrgId !== 'string') return false;
    if (!Array.isArray(userOrgIds) || userOrgIds.length === 0) return false;
    return userOrgIds.some((id) => id === targetOrgId);
}

/** id организаций из ответа Clerk getOrganizationMembershipList (устойчиво к форме ответа). */
export function extractOrgIds(memberships) {
    const list = (memberships && memberships.data) || [];
    if (!Array.isArray(list)) return [];
    return list
        .map((m) => (m && m.organization && m.organization.id) || null)
        .filter((id) => typeof id === 'string' && id.length > 0);
}
