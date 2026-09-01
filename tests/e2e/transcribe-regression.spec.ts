import { test, expect } from '@playwright/test';
import { openPlayer, resetMockData } from './support';

/** T-29 REPRO: React #321 (invalid hook call) при запуске транскрибации. */
test('REPRO: Generate Transcript → захват неминифицированной ошибки', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e?.stack || e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  // 1 секунда тишины 16kHz mono WAV как data-URI: extractAudioFromUrl декодирует без сети
  const wav = await page.evaluate((): string => {
    const sr = 16000, n = sr;
    const buf = new ArrayBuffer(44 + n * 2);
    const v = new DataView(buf);
    const ws = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    ws(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); ws(8, 'WAVE'); ws(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    ws(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, 0, true);
    let bin = ''; const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return 'data:audio/wav;base64,' + btoa(bin);
  });

  resetMockData(page);
  await page.addInitScript((uri: string) => {
    const KEY = 'anotee_projects_data';
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw);
      for (const p of data) for (const a of p.assets || []) for (const ver of a.versions || []) { ver.url = uri; }
      localStorage.setItem(KEY, JSON.stringify(data));
    }
  }, wav);

  await openPlayer(page);
  await page.getByText('Transcript').first().click();
  await page.getByRole('button', { name: /Generate Transcript/i }).dispatchEvent('click');

  // ждём либо прогресс (воспроизведение бага), либо ошибку
  await page.waitForTimeout(4000);
  expect(errors.filter((e) => /321|Invalid hook/i.test(e))).toEqual([]);
});
