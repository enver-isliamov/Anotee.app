
import { pipeline, env } from '@huggingface/transformers';

// Skip local model checks since we are running in browser
env.allowLocalModels = false;
env.useBrowserCache = true;

class TranscriptionPipeline {
  static task = 'automatic-speech-recognition';
  static model = 'Xenova/whisper-tiny'; 
  static instance: any = null;

  static async getInstance(progressCallback: (data: any) => void, modelName: string) {
    // Reload if model changed or instance doesn't exist
    if (this.instance === null || this.model !== modelName) {
      this.model = modelName;
      // Dispose old instance if exists (though JS GC handles it usually, explicit cleanup is hard with closures)
      this.instance = await pipeline(this.task, this.model, {
        progress_callback: progressCallback
      });
    }
    return this.instance;
  }
}

self.addEventListener('message', async (event) => {
  const { type, audio, language, model } = event.data;

  if (type === 'transcribe') {
    try {
      const modelName = model || 'Xenova/whisper-tiny';

      const transcriber = await TranscriptionPipeline.getInstance((data) => {
        self.postMessage({ type: 'download', data });
      }, modelName);

      const options: any = {
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: true,
      };

      // If language is specified and not 'auto', force it.
      // If undefined or 'auto', Whisper detects language automatically.
      if (language && language !== 'auto') {
          options.language = language;
      }

      const output = await transcriber(audio, options);

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
