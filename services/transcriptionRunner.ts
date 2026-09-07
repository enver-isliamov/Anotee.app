// T-37: синглтон транскрибации — воркер живёт вне React, переживает уход со страницы плеера.
// Состояние шарится между маунтами Player через подписки.
import { saveTranscript } from './transcriptStore';

export type TranscriptionChunk = { text: string; timestamp: [number, number] | null };
export type TranscriptionState = {
  isTranscribing: boolean;
  versionId: string | null;
  progress: { status: 'init' | 'downloading' | 'processing'; progress: number } | null;
  chunks: TranscriptionChunk[] | null;
};

let state: TranscriptionState = { isTranscribing: false, versionId: null, progress: null, chunks: null };
let worker: Worker | null = null;
const listeners = new Set<(s: TranscriptionState) => void>();

function emit() { listeners.forEach((l) => { try { l(state); } catch { /* слушатель отписан */ } }); }

export function subscribeTranscription(cb: (s: TranscriptionState) => void): () => void {
  listeners.add(cb);
  cb(state);
  return () => { listeners.delete(cb); };
}

export function getTranscriptionState(): TranscriptionState { return state; }

export function isTranscriptionRunning(): boolean { return state.isTranscribing; }

export function cancelTranscription(): void {
  if (worker) { try { worker.terminate(); } catch { /* ignore */ } worker = null; }
  state = { isTranscribing: false, versionId: state.versionId, progress: null, chunks: state.chunks };
  emit();
}

export function startTranscription(versionId: string, opts: {
  audio: Float32Array;
  language: string;
  model: string;
  wordTimestamps: boolean;
  modelBaseUrl?: string;
  engine: 'whisper' | 'whisper-webgpu' | 'vosk';
}): void {
  if (state.isTranscribing) return;
  // T-37: фейковый движок для e2e — детерминированно
  const fakeRaw = typeof window !== 'undefined' ? (window as any).__anoteeFakeTranscribe : undefined;
  state = { isTranscribing: true, versionId, progress: { status: 'init', progress: 0 }, chunks: null };
  emit();
  const finishOk = (chunks: TranscriptionChunk[]) => {
    state = { ...state, isTranscribing: false, progress: null, chunks };
    try { saveTranscript(versionId, chunks); } catch { /* ignore */ }
    if (worker) { try { worker.terminate(); } catch { /* ignore */ } worker = null; }
    emit();
  };
  const fail = (msg: string) => {
    state = { ...state, isTranscribing: false, progress: null };
    if (worker) { try { worker.terminate(); } catch { /* ignore */ } worker = null; }
    emit();
    if (typeof window !== 'undefined') console.error('[transcription]', msg);
  };
  if (fakeRaw) {
    const words = JSON.parse(fakeRaw) as Array<{ word: string; start: number; end: number }>;
    const chunks = words.map((w) => ({ text: w.word, timestamp: [w.start, w.end] as [number, number] }));
    state.progress = { status: 'downloading', progress: 50 }; emit();
    setTimeout(() => finishOk(chunks), 150);
    return;
  }
  if (opts.engine === 'vosk') { fail('VOSK_NOT_SUPPORTED_IN_RUNNER'); return; }
  try {
    worker = new Worker(new URL('./transcriptionWorker.ts', import.meta.url), { type: 'module' });
  } catch (e: any) { fail(e?.message || 'worker create failed'); return; }
  worker.onmessage = (event) => {
    const { type, data, result, error } = event.data;
    if (type === 'download') {
      if (data.status === 'progress') { state.progress = { status: 'downloading', progress: data.progress || 0 }; emit(); }
      else if (data.status === 'done') { state.progress = { status: 'processing', progress: 0 }; emit(); }
    } else if (type === 'warn') {
      if (typeof window !== 'undefined') console.warn('[transcription]', data?.message);
    } else if (type === 'complete') {
      const chunks: TranscriptionChunk[] = (result && Array.isArray(result.chunks)) ? result.chunks : [];
      if (chunks.length === 0) { fail('Empty transcription'); return; }
      finishOk(chunks);
    } else if (type === 'error') {
      fail(error || 'Transcription failed');
    }
  };
  worker.onerror = (e) => { fail(e?.message || 'Worker error'); };
  worker.postMessage({
    type: 'transcribe',
    audio: opts.audio,
    language: opts.language,
    model: opts.model,
    wordTimestamps: opts.wordTimestamps,
    modelBaseUrl: opts.modelBaseUrl,
    device: opts.engine === 'whisper-webgpu' ? 'webgpu' : undefined,
  });
}
