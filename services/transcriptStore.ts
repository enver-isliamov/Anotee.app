// T-24: персистентное хранилище транскриптов (localStorage, по versionId).
// Транскрипт не должен пропадать при смене вкладки/выходе из плеера.
// Удаления слов уже персистятся как комментарии в проекте; сам текст храним локально
// (word-level JSON большой — в project JSON не кладём, чтобы не раздувать синхронизацию).
const KEY_PREFIX = 'anotee_transcript_';
const INDEX_KEY = 'anotee_transcript_index';
const MAX_STORED = 12; // LRU: держим последние 12 версий

export type StoredChunk = { text: string; timestamp: [number, number] | null };

export function loadTranscript(versionId: string): StoredChunk[] | null {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + versionId);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    touchIndex(versionId);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch { return null; }
}

export function saveTranscript(versionId: string, chunks: StoredChunk[]): void {
  try {
    localStorage.setItem(KEY_PREFIX + versionId, JSON.stringify(chunks));
    touchIndex(versionId);
    pruneOld();
  } catch { /* переполнение квоты — не критично */ }
}

export function clearTranscript(versionId: string): void {
  try { localStorage.removeItem(KEY_PREFIX + versionId); } catch { /* ignore */ }
  try {
    const idx = getIndex().filter((id) => id !== versionId);
    localStorage.setItem(INDEX_KEY, JSON.stringify(idx));
  } catch { /* ignore */ }
}

function getIndex(): string[] {
  try { return JSON.parse(localStorage.getItem(INDEX_KEY) || '[]'); } catch { return []; }
}

function touchIndex(versionId: string) {
  try {
    const idx = getIndex().filter((id) => id !== versionId);
    idx.unshift(versionId);
    localStorage.setItem(INDEX_KEY, JSON.stringify(idx.slice(0, MAX_STORED)));
  } catch { /* ignore */ }
}

function pruneOld() {
  const idx = getIndex();
  idx.slice(MAX_STORED).forEach((id) => { try { localStorage.removeItem(KEY_PREFIX + id); } catch { /* ignore */ } });
}
