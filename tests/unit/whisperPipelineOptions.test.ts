import { describe, it, expect } from 'vitest';
import { buildWhisperPipelineOptions } from '../../services/transcriptionPipelineOptions';

describe('buildWhisperPipelineOptions (T-349)', () => {
  it('webgpu: device + fp32 для энкодера и декодера', () => {
    const o = buildWhisperPipelineOptions('webgpu');
    expect(o.device).toBe('webgpu');
    expect(o.dtype).toEqual({ encoder_model: 'fp32', decoder_model_merged: 'fp32' });
  });
  it('wasm/undefined: q8 без device (совместимо с текущим кэшем и зеркалом)', () => {
    expect(buildWhisperPipelineOptions()).toEqual({ dtype: 'q8' });
    expect(buildWhisperPipelineOptions('wasm')).toEqual({ dtype: 'q8' });
  });
});
