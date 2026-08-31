// T-27: параллельные движки транскрибации. Пользователь выбирает движок во вкладке Transcript.
// - whisper        — Whisper Xenova (WASM), универсальный
// - whisper-webgpu — тот же Whisper, но с ускорением WebGPU (быстрее, Chrome/Edge 113+)
// - vosk           — Vosk (модели alphacephei.com, отличная поддержка русского, пословные таймстампы)
//                    ЭКСПЕРИМЕНТАЛЬНЫЙ: требует SharedArrayBuffer (COOP/COEP заголовки) — см. docs/RF-RESILIENCE.md

export type TranscribeEngineId = 'whisper' | 'whisper-webgpu' | 'vosk';

export interface TranscribeProgress { status: 'init' | 'downloading' | 'processing'; progress: number; }

export interface TranscribeOpts {
  audio: Float32Array;
  language: string;          // 'auto' | 'ru' | 'en' | ...
  model: string;             // Xenova/whisper-tiny | base | ...
  wordTimestamps: boolean;
  modelBaseUrl?: string;
  onProgress?: (p: TranscribeProgress) => void;
  onWarn?: (msg: string) => void;
}

const WHISPER_WORKER_CDN_FALLBACK = false;

type EngineChunk = { text: string; timestamp: [number, number] | null };

/** Whisper через воркер transcriptionWorker.ts (WASM или WebGPU). */
async function transcribeWhisper(opts: TranscribeOpts, device?: 'webgpu'): Promise<EngineChunk[]> {
  return new Promise<EngineChunk[]>((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('./transcriptionWorker.ts', import.meta.url), { type: 'module' });
    } catch (e: any) {
      reject(new Error(e?.message || 'Failed to create transcription worker'));
      return;
    }
    const cleanup = () => { try { worker.terminate(); } catch { /* ignore */ } };
    worker.onmessage = (event) => {
      const { type, data, result, error } = event.data;
      if (type === 'download') {
        if (data.status === 'progress') opts.onProgress?.({ status: 'downloading', progress: data.progress || 0 });
        else if (data.status === 'done') opts.onProgress?.({ status: 'processing', progress: 0 });
      } else if (type === 'warn') {
        opts.onWarn?.(data?.message || 'warning');
      } else if (type === 'complete') {
        cleanup();
        if (result && Array.isArray(result.chunks)) resolve(result.chunks);
        else reject(new Error('Empty transcription result'));
      } else if (type === 'error') {
        cleanup();
        reject(new Error(error || 'Transcription failed'));
      }
    };
    worker.onerror = (e) => { cleanup(); reject(new Error(e?.message || 'Worker error')); };
    worker.postMessage({
      type: 'transcribe',
      audio: opts.audio,
      language: opts.language,
      model: opts.model,
      wordTimestamps: opts.wordTimestamps,
      modelBaseUrl: opts.modelBaseUrl,
      device,
    });
  });
}

const VOSK_CDN = 'https://cdn.jsdelivr.net/npm/vosk-browser@0.0.8/dist/vosk.js';
const VOSK_MODEL_RU = 'https://alphacephei.com/vosk/models/vosk-model-small-ru-0.22.zip';

/** Маппинг слов Vosk ({word,start,end}) в стандартные чанки транскрипта. */
export function voskWordsToChunks(words: Array<{ word: string; start: number; end: number }>): EngineChunk[] {
  return words
    .filter((w) => typeof w?.start === 'number' && typeof w?.word === 'string')
    .map((w) => ({ text: w.word, timestamp: [w.start, w.end] as [number, number] }));
}

/** Vosk: отличное распознавание русского, быстрые компактные модели alphacephei.com.
 *  ЭКСПЕРИМЕНТАЛЬНО: нужен SharedArrayBuffer (COOP/COEP заголовки на странице). */
async function transcribeVosk(opts: TranscribeOpts): Promise<EngineChunk[]> {
  if (typeof SharedArrayBuffer === 'undefined') {
    throw new Error('VOSK_NO_SAB');
  }
  opts.onProgress?.({ status: 'downloading', progress: 5 });
  const voskModule: any = await import(/* @vite-ignore */ VOSK_CDN);
  const modelUrl = opts.language === 'en' || opts.language === 'en-US'
    ? 'https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip'
    : VOSK_MODEL_RU;
  const model = await voskModule.createModel(modelUrl);
  opts.onProgress?.({ status: 'processing', progress: 10 });

  const OfflineCtx: any = (window as any).OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  const offline = new OfflineCtx(1, Math.max(1, opts.audio.length), 16000);
  const buffer = offline.createBuffer(1, opts.audio.length, 16000);
  buffer.copyToChannel(opts.audio, 0);

  const recognizer: any = new model.KaldiRecognizer(16000);
  recognizer.setWords(true);

  const words: Array<{ word: string; start: number; end: number }> = [];
  recognizer.on('result', (msg: any) => {
    const res = msg?.result?.result;
    if (Array.isArray(res)) words.push(...res);
  });

  const CHUNK = 16000; // 1 секунда на порцию
  const total = buffer.length;
  for (let offset = 0; offset < total; offset += CHUNK) {
    const end = Math.min(offset + CHUNK, total);
    const sliceBuf = offline.createBuffer(1, end - offset, 16000);
    sliceBuf.copyToChannel(opts.audio.subarray(offset, end), 0);
    await recognizer.acceptWaveform(sliceBuf);
    opts.onProgress?.({ status: 'processing', progress: 10 + Math.round((end / total) * 85) });
  }
  // сброс хвоста: короткая тишина заставляет распознаватель отдать финальный результат
  const tail = offline.createBuffer(1, 8000, 16000);
  await recognizer.acceptWaveform(tail);
  await new Promise((r) => setTimeout(r, 300));

  try { recognizer.remove?.(); } catch { /* ignore */ }
  try { model.terminate?.(); } catch { /* ignore */ }

  const chunks = voskWordsToChunks(words);
  if (chunks.length === 0) throw new Error('VOSK_EMPTY');
  opts.onProgress?.({ status: 'processing', progress: 100 });
  return chunks;
}

export async function transcribeWithEngine(engineId: TranscribeEngineId, opts: TranscribeOpts): Promise<EngineChunk[]> {
  switch (engineId) {
    case 'whisper-webgpu':
      // Фолбэк на WASM уже внутри воркера (device fallback)
      return transcribeWhisper(opts, 'webgpu');
    case 'vosk':
      return transcribeVosk(opts);
    case 'whisper':
    default:
      return transcribeWhisper(opts);
  }
}

export function isEngineAvailable(id: TranscribeEngineId): boolean {
  if (id === 'vosk') return typeof SharedArrayBuffer !== 'undefined';
  if (id === 'whisper-webgpu') return typeof (navigator as any).gpu !== 'undefined';
  return true;
}
