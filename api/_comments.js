/**
 * T-13: идемпотентное применение действий с комментариями.
 * Раньше повторный create (retry при 409 / гонка с полным sync проекта) добавлял копию
 * комментария с тем же id — в версии появлялись дубликаты. Чистая функция — покрыта
 * unit-тестами (tests/unit/comments.test.ts).
 */

/**
 * @param {Array<{id:string}>} comments - массив комментариев версии (мутируется)
 * @param {'create'|'update'|'delete'} action
 * @param {object} payload - данные комментария (payload.id обязателен)
 * @param {string} userId - автор действия (для create)
 * @returns {{status:'created'|'exists'|'updated'|'deleted'|'missing'|'noop'}}
 */
export function applyCommentAction(comments, action, payload, userId) {
    if (!Array.isArray(comments) || !payload || !payload.id) return { status: 'noop' };
    switch (action) {
        case 'create': {
            if (comments.some((c) => c && c.id === payload.id)) return { status: 'exists' };
            comments.push({ ...payload, userId, createdAt: 'Just now' });
            return { status: 'created' };
        }
        case 'update': {
            const i = comments.findIndex((c) => c && c.id === payload.id);
            if (i === -1) return { status: 'missing' };
            comments[i] = { ...comments[i], ...payload };
            return { status: 'updated' };
        }
        case 'delete': {
            const i = comments.findIndex((c) => c && c.id === payload.id);
            if (i === -1) return { status: 'missing' };
            comments.splice(i, 1);
            return { status: 'deleted' };
        }
        default:
            return { status: 'noop' };
    }
}
