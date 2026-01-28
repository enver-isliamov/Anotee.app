
import { pipeline, env } from '@huggingface/transformers';

// Skip local model checks since we are running in browser
env.allowLocalModels = false;
env.useBrowserCache = true;

class TranscriptionPipeline {
  static task = 'automatic-speech-recognition';
  // 'Xenova/whisper-tiny' is ~40MB and runs fast on CPU.
  // 'Xenova/whisper-base' is better quality but slower.
  static model = 'Xenova/whisper-tiny'; 
  static instance: any = null;

  static async getInstance(progressCallback: (data: any) => void) {
    if (this.instance === null) {
      this.instance = await pipeline(this.task, this.model, {
        progress_callback: progressCallback
      });
    }
    return this.instance;
  }
}

self.addEventListener('message', async (event) => {
  const { type, audio, language } = event.data;

  if (type === 'transcribe') {
    try {
      const transcriber = await TranscriptionPipeline.getInstance((data) => {
        self.postMessage({ type: 'download', data });
      });

      const output = await transcriber(audio, {
        chunk_length_s: 30,
        stride_length_s: 5,
        language: language || 'en', // auto-detect if null, but 'en' default helps speed
        return_timestamps: true,
      });

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
