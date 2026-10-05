/**
 * T-349: опции создания pipeline transformers.js для Whisper.
 * ВАЖНО: device/dtype задаются при СОЗДАНИИ pipeline (в опциях вызова они не действуют).
 * - WebGPU: fp32/fp32 — максимум совместимости (int8/q8 на WebGPU не ускоряется);
 *   при сбое драйвера/памяти — авто-откат на WASM (воркер).
 * - WASM: q8 — дефолтные квантованные файлы (…_quantized.onnx), лёгкая загрузка и быстрый CPU.
 */
export type WhisperDtype = 'auto' | 'fp32' | 'fp16' | 'q8' | 'int8' | 'uint8' | 'q4' | 'bnb4' | 'q4f16';
export type WhisperPipelineOptions = {
  device?: 'webgpu';
  dtype: WhisperDtype | Record<string, WhisperDtype>;
};

export function buildWhisperPipelineOptions(device?: string): WhisperPipelineOptions {
  if (device === 'webgpu') {
    return {
      device: 'webgpu',
      dtype: { encoder_model: 'fp32', decoder_model_merged: 'fp32' },
    };
  }
  return { dtype: 'q8' };
}
