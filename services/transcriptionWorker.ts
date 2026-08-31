import { pipeline, env, type PipelineType } from '@huggingface/transformers';

// Skip local model checks since we are running in browser
env.allowLocalModels = false;
env.useBrowserCache = true;

// Дефолтный хост HF Hub (совпадает с env.remoteHost по умолчанию в transformers.js 3.8.1).
// Может быть переопределён зеркалом через modelBaseUrl в сообщении воркера
// (VITE_WHISPER_MODEL_BASE_URL, см. docs/RF-RESILIENCE.md).
const DEFAULT_REMOTE_HOST = 'https://huggingface.co/';

const normalizeHost = (url: string): string => (url.endsWith('/') ? url : `${url}/`);

class TranscriptionPipeline {
  static task: PipelineType = 'automatic-speech-recognition';
  static model = 'Xenova/whisper-tiny';
  static remoteHost = DEFAULT_REMOTE_HOST;
  static instance: any = null;

  static async getInstance(progressCallback: (data: any) => void, modelName: string, remoteHost: string = DEFAULT_REMOTE_HOST) {
    // Reload if model or remote host changed, or instance doesn't exist
    // (env.remoteHost читается pipeline'ом в момент создания, поэтому смена
    // зеркала требует пересоздания инстанса, как и смена модели).
    if (this.instance === null || this.model !== modelName || this.remoteHost !== remoteHost) {
      this.model = modelName;
      this.remoteHost = remoteHost;
      // Dispose old instance if exists (though JS GC handles it usually, explicit cleanup is hard with closures)
      this.instance = await pipeline(this.task, this.model, {
        progress_callback: progressCallback
      });
    }
    return this.instance;
  }
}

self.addEventListener('message', async (event) => {
      const { type, audio, language, model, modelBaseUrl, wordTimestamps, device } = event.data;

  if (type === 'transcribe') {
    try {
      const modelName = model || 'Xenova/whisper-tiny';

      // Кастомное зеркало модели (РФ-устойчивость): выставляем env.remoteHost ДО создания
      // pipeline, иначе файлы модели запросятся с huggingface.co / cdn-lfs.huggingface.co,
      // недоступных из РФ. remotePathTemplate не трогаем — зеркало обязано повторять
      // структуру HF Hub: {model}/resolve/{revision}/ (см. docs/RF-RESILIENCE.md).
      // Без modelBaseUrl поведение прежнее (дефолтный хост, browser-cache включён).
      const requestedHost = modelBaseUrl ? normalizeHost(String(modelBaseUrl)) : DEFAULT_REMOTE_HOST;
      if (requestedHost !== DEFAULT_REMOTE_HOST) {
        env.remoteHost = requestedHost;
      }

      const transcriber = await TranscriptionPipeline.getInstance((data) => {
        self.postMessage({ type: 'download', data });
      }, modelName, requestedHost);

      const options: any = {
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: wordTimestamps ? "word" : true,
      };

      // T-27: WebGPU-ускорение (движок whisper-webgpu). При ошибке — авто-откат на WASM.
      if (device === 'webgpu') options.device = 'webgpu';

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
        // T-27: WebGPU не сработал (драйвер/память) — откат на WASM
        else if (device === 'webgpu') {
          self.postMessage({ type: 'warn', data: { message: 'webgpu failed, falling back to wasm' } });
          output = await transcriber(audio, { ...options, device: 'wasm' });
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
