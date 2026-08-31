import { Comment } from '../types';

/**
 * T-20: утилиты word-level транскрибации и пословного удаления.
 * Удаление слова/фразы = комментарий с editKind: 'delete', чей
 * [timestamp, timestamp+duration] перекрывает тайм-диапазон слова.
 * Комментарии персистятся в проекте — удаления переживают перегенерацию транскрипта
 * (при новой транскрибации удаления пере-применяются по совпадению таймкодов).
 */

export type WordChunk = { text: string; timestamp: [number, number] | null };

const OVERLAP_EPS = 0.05;

export const isDeletionComment = (c: Comment): boolean =>
  (c as unknown as { editKind?: string }).editKind === 'delete';

/** Перекрывает ли комментарий-удаление диапазон [start, end] (с допуском). */
export function overlapsDeletion(c: Comment, start: number, end: number): boolean {
  if (!isDeletionComment(c)) return false;
  const cs = c.timestamp;
  const ce = c.timestamp + (c.duration ?? 0);
  return start < ce + OVERLAP_EPS && end > cs - OVERLAP_EPS;
}

/** Комментарий-удаление, перекрывающий данное слово (или null). */
export function findDeletionComment(comments: Comment[], word: WordChunk): Comment | null {
  if (!word.timestamp) return null;
  const [s, e] = word.timestamp;
  return comments.find((c) => overlapsDeletion(c, s, e)) ?? null;
}

export function isWordDeleted(comments: Comment[], word: WordChunk): boolean {
  return findDeletionComment(comments, word) !== null;
}

/** Существующие удаления, попадающие в диапазон фразы [startTs, endTs]. */
export function findDeletionsInRange(comments: Comment[], startTs: number, endTs: number): Comment[] {
  return comments.filter((c) => overlapsDeletion(c, startTs, endTs));
}

/** Текст фразы для комментария-удаления по диапазону индексов слов (включительно). */
export function rangeDeletionText(words: WordChunk[], fromIdx: number, toIdx: number): string {
  const from = Math.max(0, Math.min(fromIdx, toIdx));
  const to = Math.min(words.length - 1, Math.max(fromIdx, toIdx));
  return words
    .slice(from, to + 1)
    .map((w) => w.text.trim())
    .filter(Boolean)
    .join(' ');
}
