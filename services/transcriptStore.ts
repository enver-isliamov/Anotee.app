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
  // T-119: параллельно пишем в IndexedDB (не блокирует UI)
  void saveTranscriptToIdb(versionId, chunks);
}

export function clearTranscript(versionId: string): void {
  try { localStorage.removeItem(KEY_PREFIX + versionId); } catch { /* ignore */ }
  try {
    const idx = getIndex().filter((id) => id !== versionId);
    localStorage.setItem(INDEX_KEY, JSON.stringify(idx));
  } catch { /* ignore */ }
}


// T-119: IndexedDB-слой — word-level JSON больше лимита localStorage (~5MB).
// localStorage остаётся быстрым синхронным кэшем; IDB — надёжным хранилищем.
const DB_NAME = 'anotee_transcripts';
const DB_STORE = 'transcripts';
const DB_VER = 1;

function openTranscriptDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') { resolve(null); return; }
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}

/** T-119: сохранить транскрипт в IndexedDB (вызывается параллельно с localStorage). */
export async function saveTranscriptToIdb(versionId: string, chunks: StoredChunk[]): Promise<void> {
  const db = await openTranscriptDB();
  if (!db) return;
  try {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put({ chunks, savedAt: Date.now() }, versionId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  } finally { try { db.close(); } catch { /* ignore */ } }
}

/** T-119: прочитать транскрипт из IndexedDB (если в localStorage его нет). */
export async function loadTranscriptFromIdb(versionId: string): Promise<StoredChunk[] | null> {
  const db = await openTranscriptDB();
  if (!db) return null;
  try {
    return await new Promise<StoredChunk[] | null>((resolve) => {
      const tx = db.transaction(DB_STORE, 'readonly');
      const req = tx.objectStore(DB_STORE).get(versionId);
      req.onsuccess = () => {
        const val = req.result && req.result.chunks;
        resolve(Array.isArray(val) && val.length > 0 ? val : null);
      };
      req.onerror = () => resolve(null);
    });
  } finally { try { db.close(); } catch { /* ignore */ } }
}

/** T-119: сначала localStorage (быстро), затем IndexedDB; при попадании в IDB прогреваем localStorage. */
export async function loadTranscriptWithIdb(versionId: string): Promise<StoredChunk[] | null> {
  const local = loadTranscript(versionId);
  if (local) return local;
  const idb = await loadTranscriptFromIdb(versionId);
  if (idb) { saveTranscript(versionId, idb); return idb; }
  return null;
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
