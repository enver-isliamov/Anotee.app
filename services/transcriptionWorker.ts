import { pipeline, env, type PipelineType } from '@huggingface/transformers';
import { buildWhisperPipelineOptions, legacyModelName } from './transcriptionPipelineOptions';

// Skip local model checks since we are running in browser
env.allowLocalModels = false;
env.useBrowserCache = true;
// T-38: iOS Safari — нет SharedArrayBuffer без COOP/COEP → многопоточный WASM не работает.
if (typeof SharedArrayBuffer === 'undefined') {
  if (env.backends.onnx.wasm) env.backends.onnx.wasm.numThreads = 1;
}

// Дефолтный хост HF Hub (совпадает с env.remoteHost по умолчанию в transformers.js 3.8.1).
// Может быть переопределён зеркалом через modelBaseUrl в сообщении воркера
// (VITE_WHISPER_MODEL_BASE_URL, см. docs/RF-RESILIENCE.md).
const DEFAULT_REMOTE_HOST = 'https://huggingface.co/';

const normalizeHost = (url: string): string => (url.endsWith('/') ? url : `${url}/`);

class TranscriptionPipeline {
  static task: PipelineType = 'automatic-speech-recognition';
  static model = 'onnx-community/whisper-tiny';
  static remoteHost = DEFAULT_REMOTE_HOST;
  static device: string | undefined = undefined;
  static instance: any = null;

  static reset() {
    this.instance = null;
  }

  static async getInstance(progressCallback: (data: any) => void, modelName: string, remoteHost: string = DEFAULT_REMOTE_HOST, device?: string) {
    // Reload if model / remote host / device changed, or instance doesn't exist.
    // ВАЖНО (T-349): device и dtype применяются при СОЗДАНИИ pipeline — смена
    // устройства (webgpu↔wasm) требует пересоздания инстанса.
    if (this.instance === null || this.model !== modelName || this.remoteHost !== remoteHost || this.device !== device) {
      this.model = modelName;
      this.remoteHost = remoteHost;
      this.device = device;
      this.instance = await pipeline(this.task, this.model, {
        progress_callback: progressCallback,
        ...buildWhisperPipelineOptions(device),
      });
    }
    return this.instance;
  }
}

self.addEventListener('message', async (event) => {
      const { type, audio, language, model, modelBaseUrl, wordTimestamps, device } = event.data;

  if (type === 'transcribe') {
    try {
      const modelName = model || 'onnx-community/whisper-tiny';

      // Кастомное зеркало модели (РФ-устойчивость): выставляем env.remoteHost ДО создания
      // pipeline, иначе файлы модели запросятся с huggingface.co / cdn-lfs.huggingface.co,
      // недоступных из РФ. remotePathTemplate не трогаем — зеркало обязано повторять
      // структуру HF Hub: {model}/resolve/{revision}/ (см. docs/RF-RESILIENCE.md).
      // Без modelBaseUrl поведение прежнее (дефолтный хост, browser-cache включён).
      const requestedHost = modelBaseUrl ? normalizeHost(String(modelBaseUrl)) : DEFAULT_REMOTE_HOST;
      if (requestedHost !== DEFAULT_REMOTE_HOST) {
        env.remoteHost = requestedHost;
      }

      let transcriber;
      try {
        transcriber = await TranscriptionPipeline.getInstance((data) => {
          self.postMessage({ type: 'download', data });
        }, modelName, requestedHost, device);
      } catch (loadErr: any) {
        // T-352: устойчивость — если новая модель (onnx-community/*) не загрузилась
        // (например, зеркало наполнено файлами Xenova/*), пробуем классическое имя.
        const legacy = legacyModelName(modelName);
        if (!legacy) throw loadErr;
        self.postMessage({ type: 'warn', data: { message: 'model fallback: ' + modelName + ' → ' + legacy } });
        TranscriptionPipeline.reset();
        transcriber = await TranscriptionPipeline.getInstance((data) => {
          self.postMessage({ type: 'download', data });
        }, legacy, requestedHost, device);
      }

      const options: any = {
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: wordTimestamps ? "word" : true,
      };

      // T-349: устройство (webgpu) и dtype задаются при СОЗДАНИИ pipeline
      // (см. TranscriptionPipeline.getInstance → buildWhisperPipelineOptions);
      // в опциях вызова device не действует.

      // If language is specified and not 'auto', force it.
      // If undefined or 'auto', Whisper detects language automatically.
      if (language && language !== 'auto') {
          options.language = language;
          options.task = 'transcribe';
      }

      let output: any;
      try {
        output = await transcriber(audio, options);
      } catch (runErr: any) {
        const msg = String(runErr?.message || runErr);
        // T-25: устойчивость — некоторые модели/языки не поддерживают word-level таймстампы
        if (wordTimestamps && /word|timestamp|alignment/i.test(msg)) {
          self.postMessage({ type: 'warn', data: { message: 'word-level unsupported, falling back to sentence-level' } });
          output = await transcriber(audio, { ...options, return_timestamps: true });
        }
        // T-27/T-349: WebGPU не сработал (драйвер/память) — откат на WASM.
        // Важно: инстанс пересоздаём с device=undefined (иначе останется webgpu-граф).
        else if (device === 'webgpu') {
          self.postMessage({ type: 'warn', data: { message: 'webgpu failed, falling back to wasm' } });
          TranscriptionPipeline.reset();
          const wasmTranscriber = await TranscriptionPipeline.getInstance((data) => {
            self.postMessage({ type: 'download', data });
          }, modelName, requestedHost, undefined);
          output = await wasmTranscriber(audio, options);
        } else {
          throw runErr;
        }
      }

      self.postMessage({
        type: 'complete',
        result: output,
      });
    } catch (error: any) {
      self.postMessage({
        type: 'error',
        error: error.message,
      });
    }
  }
});
