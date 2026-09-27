/**
 * T-04/T-06: чистые правила доступа (без зависимостей) — покрыты unit-тестами.
 */

/** Поля проекта, менять которые может только владелец/менеджер. */
export const STRUCTURAL_PROJECT_FIELDS = [
    'name', 'description', 'team', 'publicAccess', 'publicShare',
    'isLocked', 'orgId', 'assets', 'ownerId', 'folderId'
];

/**
 * T-04: ключ объекта должен лежать внутри папки проекта: anotee/{projectId}/...
 * Также принимает сам префикс папки (для delete_folder).
 */
export function isKeyInProject(key, projectId) {
    if (!key || typeof key !== 'string' || !projectId || typeof projectId !== 'string') return false;
    const prefix = 'anotee/' + projectId + '/';
    return key === 'anotee/' + projectId || key.startsWith(prefix);
}

/** T-04: все ключи (или префикс) принадлежат проекту. */
export function areKeysInProject(keys, projectId) {
    if (!Array.isArray(keys) || keys.length === 0) return false;
    return keys.every((k) => isKeyInProject(k, projectId));
}

/**
 * T-06: может ли пользователь менять настройки проекта.
 * Владелец (по id/userId/email) или участник с ролью manager/owner/admin.
 */
export function canManageProject(user, projectRow) {
    if (!user || !projectRow) return false;
    const owner = projectRow.owner_id;
    if (owner && (owner === user.id || owner === user.userId || owner === user.email)) return true;
    const team = (projectRow.data && projectRow.data.team) || [];
    if (!Array.isArray(team)) return false;
    const me = team.find((m) => m && (m.id === user.id || m.id === user.userId || m.email === user.email));
    if (!me) return false;
    const role = String(me.role || '').toLowerCase();
    return role === 'manager' || role === 'owner' || role === 'admin';
}

/** T-06: содержит ли набор изменений структурные поля. */
export function touchesStructuralFields(updates) {
    if (!updates || typeof updates !== 'object') return false;
    return Object.keys(updates).some((k) => STRUCTURAL_PROJECT_FIELDS.includes(k));
}

/** T-06: для участника без прав — оставляем серверные значения структурных полей. */
export function stripStructuralChanges(incoming, existing) {
    const out = { ...(incoming || {}) };
    for (const f of STRUCTURAL_PROJECT_FIELDS) {
        if (existing && Object.prototype.hasOwnProperty.call(existing, f)) out[f] = existing[f];
        else delete out[f];
    }
    return out;
}
