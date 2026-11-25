import { test, expect } from '@playwright/test';
import { openPlayer, resetMockData, installVideoMock, dispatchVideoLoadedMetadata } from './support';

// T-361 (регресс): клик по слову ВНУТРИ выделенного фрагмента не должен сбрасывать выделение
// до одного слова; клик ВНЕ фрагмента — по-прежнему выделяет одно слово.
// Воспроизведено из жалобы владельца: «при выделении текста при клике слетало выделение».

const FAKE_WORDS = [
  { word: 'Альфа', start: 0.0, end: 0.5 },
  { word: 'бета', start: 0.5, end: 1.0 },
  { word: 'гамма', start: 1.0, end: 2.0 },
  { word: 'дельта.', start: 2.0, end: 3.0 },
];

async function selCount(page: any): Promise<number> {
  return await page.evaluate(() => {
    const words = [...document.querySelectorAll('[data-testid="transcript-word"]')];
    return words.filter((w: any) => String(w.className).includes('bg-indigo-500/20')).length;
  });
}

test('T-361: клик внутри выделения сохраняет фрагмент; клик вне — выделяет слово', async ({ page }) => {
  test.setTimeout(120_000);
  resetMockData(page);
  await installVideoMock(page);
  await page.addInitScript((words: any) => { (window as any).__anoteeFakeTranscribe = JSON.stringify(words); }, FAKE_WORDS);
  await openPlayer(page);
  await dispatchVideoLoadedMetadata(page);
  await page.getByTestId('transcript-tab').click();
  const gen = page.getByRole('button', { name: /Generate Transcript/i });
  try { await gen.click({ timeout: 3000 }); } catch { await gen.dispatchEvent('click'); }
  await expect(page.getByTestId('transcript-word')).toHaveCount(4, { timeout: 10000 });

  const words = page.getByTestId('transcript-word');

  // 1) клик по одному слову — выделено 1, док открыт
  await words.nth(1).click();
  await expect(page.getByTestId('word-sheet')).toBeVisible();
  expect(await selCount(page)).toBe(1);

  // 2) drag 0..2 — выделено 3
  const b0 = await words.nth(0).boundingBox();
  const b2 = await words.nth(2).boundingBox();
  expect(b0 && b2).toBeTruthy();
  await page.mouse.move(b0!.x + b0!.width / 2, b0!.y + b0!.height / 2);
  await page.mouse.down();
  await page.mouse.move(b2!.x + b2!.width / 2, b2!.y + b2!.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  expect(await selCount(page), 'после drag выделен фрагмент из 3 слов').toBe(3);

  // 3) КЛИК по слову 1 внутри фрагмента — выделение СОХРАНЯЕТСЯ (регресс T-361)
  await words.nth(1).click();
  await page.waitForTimeout(250);
  expect(await selCount(page), 'клик внутри выделения не сбрасывает фрагмент').toBe(3);

  // 4) клик по слову 3 (вне фрагмента) — выделяется одно слово
  await words.nth(3).click();
  await page.waitForTimeout(250);
  expect(await selCount(page), 'клик вне фрагмента выделяет одно слово').toBe(1);
});
