import { describe, it, expect } from 'vitest';
import {
  isDeletionComment,
  overlapsDeletion,
  findDeletionComment,
  isWordDeleted,
  findDeletionsInRange,
  rangeDeletionText,
} from '../../services/transcriptUtils';
import { Comment, CommentStatus } from '../../types';

const mkComment = (over: Partial<Comment> & { timestamp: number; duration?: number }): Comment => ({
  id: 'c1',
  userId: 'u1',
  text: 'x',
  status: CommentStatus.OPEN,
  createdAt: 'now',
  ...over,
});

const mkWord = (text: string, start: number, end: number) => ({ text, timestamp: [start, end] as [number, number] });

describe('transcriptUtils', () => {
  it('isDeletionComment различает editKind', () => {
    expect(isDeletionComment(mkComment({ timestamp: 1, editKind: 'delete' }))).toBe(true);
    expect(isDeletionComment(mkComment({ timestamp: 1 }))).toBe(false);
  });

  it('overlapsDeletion: перекрытие по центру слова (T-95)', () => {
    const del = mkComment({ timestamp: 2, duration: 0.5, editKind: 'delete' }); // [2.0, 2.5]
    expect(overlapsDeletion(del, 2.1, 2.3)).toBe(true);   // центр 2.2 внутри
    expect(overlapsDeletion(del, 1.95, 2.05)).toBe(true); // центр 2.0 внутри
    expect(overlapsDeletion(del, 2.45, 2.55)).toBe(true); // центр 2.5 внутри (в EPS)
    expect(overlapsDeletion(del, 2.5, 3.0)).toBe(false);  // T-95: СОСЕДНЕЕ слово справа больше не удаляется
    expect(overlapsDeletion(del, 1.5, 2.0)).toBe(false);  // T-95: соседнее слева больше не удаляется
    expect(overlapsDeletion(del, 2.6, 3.0)).toBe(false);
    expect(overlapsDeletion(del, 1.0, 1.9)).toBe(false);
  });

  it('T-95 регрессия: удаление фразы не задевает соседние слова', () => {
    const del = mkComment({ timestamp: 1.4, duration: 0.4, editKind: 'delete' }); // фраза [1.4, 1.8]
    expect(overlapsDeletion(del, 1.0, 1.4)).toBe(false); // слово до фразы
    expect(overlapsDeletion(del, 1.45, 1.75)).toBe(true); // слово фразы
    expect(overlapsDeletion(del, 1.8, 2.2)).toBe(false); // слово после фразы
  });

  it('overlapsDeletion: не-удаление и комментарий без duration', () => {
    expect(overlapsDeletion(mkComment({ timestamp: 2 }), 2, 3)).toBe(false); // нет editKind
    const noDur = mkComment({ timestamp: 2, editKind: 'delete' }); // duration undefined → ce = 2.0
    expect(overlapsDeletion(noDur, 1.98, 2.02)).toBe(true);
    expect(overlapsDeletion(noDur, 2.1, 3)).toBe(false);
  });

  it('findDeletionComment/isWordDeleted: null-timestamp слова не удаляются', () => {
    const comments = [mkComment({ timestamp: 1, duration: 0.4, editKind: 'delete' })];
    expect(findDeletionComment(comments, mkWord('привет', 1.0, 1.3))?.id).toBe('c1');
    expect(isWordDeleted(comments, mkWord('привет', 1.0, 1.3))).toBe(true);
    expect(isWordDeleted(comments, { text: 'x', timestamp: null })).toBe(false);
    expect(isWordDeleted([], mkWord('x', 1, 1.1))).toBe(false);
  });

  it('findDeletionsInRange возвращает только удаления в диапазоне', () => {
    const comments = [
      mkComment({ id: 'd1', timestamp: 1, duration: 0.5, editKind: 'delete' }),
      mkComment({ id: 'n1', timestamp: 1.2, duration: 0.5 }), // не удаление
      mkComment({ id: 'd2', timestamp: 5, duration: 0.5, editKind: 'delete' }),
    ];
    const res = findDeletionsInRange(comments, 1.0, 1.6);
    expect(res.map((c: Comment) => c.id)).toEqual(['d1']);
  });

  it('rangeDeletionText: диапазон, разворот границ, обрезка', () => {
    const words = [mkWord('a', 0, 0.5), mkWord('b ', 0.5, 1), mkWord('c', 1, 1.5), mkWord('', 1.5, 2)];
    expect(rangeDeletionText(words, 0, 2)).toBe('a b c');
    expect(rangeDeletionText(words, 2, 0)).toBe('a b c'); // разворот границ
    expect(rangeDeletionText(words, 3, 3)).toBe('');
    expect(rangeDeletionText(words, 10, 12)).toBe('');    // вне диапазона — пусто
  });
});
