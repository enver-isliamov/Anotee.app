import { describe, it, expect } from 'vitest';
import { sanitizeRoadmapPostInput, toggleRoadmapVote, normalizeRoadmapStatus } from '../../api/_roadmap.js';

describe('roadmap: sanitizeRoadmapPostInput', () => {
  it('валидный пост нормализуется (trim, type по умолчанию feature)', () => {
    const r = sanitizeRoadmapPostInput({ title: '  Идея  ', description: '  Описание идеи ', type: 'bogus' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.title).toBe('Идея');
      expect(r.value.description).toBe('Описание идеи');
      expect(r.value.type).toBe('feature');
    }
  });
  it('короткий заголовок/описание отклоняются', () => {
    expect(sanitizeRoadmapPostInput({ title: 'ok', description: 'норм' }).ok).toBe(false);
    expect(sanitizeRoadmapPostInput({ title: 'Нормальный', description: '' }).ok).toBe(false);
  });
  it('слишком длинные поля отклоняются', () => {
    expect(sanitizeRoadmapPostInput({ title: 'x'.repeat(141), description: 'норм текст' }).ok).toBe(false);
    expect(sanitizeRoadmapPostInput({ title: 'Норм', description: 'x'.repeat(2001) }).ok).toBe(false);
  });
});

describe('roadmap: toggleRoadmapVote', () => {
  it('голос добавляется и снимается', () => {
    const a = toggleRoadmapVote({ voterIds: [] }, 'u1');
    expect(a.voted).toBe(true);
    expect(a.voterIds).toEqual(['u1']);
    const b = toggleRoadmapVote({ voterIds: a.voterIds }, 'u1');
    expect(b.voted).toBe(false);
    expect(b.voterIds).toEqual([]);
  });
  it('устойчиво к отсутствующему voterIds', () => {
    const r = toggleRoadmapVote({}, 'u2');
    expect(r.voterIds).toEqual(['u2']);
  });
});

describe('roadmap: normalizeRoadmapStatus', () => {
  it('разрешённые статусы проходят, неизвестные — null', () => {
    expect(normalizeRoadmapStatus('planned')).toBe('planned');
    expect(normalizeRoadmapStatus('in_progress')).toBe('in_progress');
    expect(normalizeRoadmapStatus('deleted')).toBe(null);
    expect(normalizeRoadmapStatus(undefined)).toBe(null);
  });
});
