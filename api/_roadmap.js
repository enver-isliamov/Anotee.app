/**
 * T-14x: дорожная карта — чистые правила (валидация ввода, голосование, статусы).
 * Покрыты unit-тестами (tests/unit/roadmap.test.ts).
 * Доска синхронизируется с «Библией проекта» (раздел «Дорожная карта», /bible.html).
 */
export const ROADMAP_TYPES = ['feature', 'bug', 'improvement'];
export const ROADMAP_STATUSES = ['under_review', 'planned', 'in_progress', 'completed', 'closed'];

/** Валидация и нормализация входных данных поста. */
export function sanitizeRoadmapPostInput(input) {
    const title = typeof input?.title === 'string' ? input.title.trim() : '';
    const description = typeof input?.description === 'string' ? input.description.trim() : '';
    const type = typeof input?.type === 'string' && ROADMAP_TYPES.includes(input.type) ? input.type : 'feature';
    if (title.length < 3) return { ok: false, error: 'Title is too short (min 3 chars)' };
    if (title.length > 140) return { ok: false, error: 'Title is too long (max 140 chars)' };
    if (description.length < 3) return { ok: false, error: 'Description is too short (min 3 chars)' };
    if (description.length > 2000) return { ok: false, error: 'Description is too long (max 2000 chars)' };
    return { ok: true, value: { title, description, type } };
}

/** Переключение голоса пользователя (идемпотентно по результату: повторный клик снимает голос). */
export function toggleRoadmapVote(post, userId) {
    const voters = Array.isArray(post.voterIds) ? post.voterIds : [];
    const has = voters.includes(userId);
    const voterIds = has ? voters.filter((id) => id !== userId) : [...voters, userId];
    return { voterIds, voted: !has };
}

/** Статус — только из белого списка. */
export function normalizeRoadmapStatus(status) {
    return ROADMAP_STATUSES.includes(status) ? status : null;
}
