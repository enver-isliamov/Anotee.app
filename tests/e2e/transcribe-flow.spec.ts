import { test, expect } from '@playwright/test';
import { openPlayer, resetMockData } from './support';

/**
 * T-30: сквозной тест транскрибации полного пути (фейковый движок — детерминированно):
 * Generate → слова рендерятся → persistence (вкладки + reload) → выделение → шит →
 * удаление фрагмента → зачёркивание + комментарий-маркер. Регрессия #321 (invalid hook).
 */
const FAKE_WORDS = [
  { word: 'First', start: 0.0, end: 0.5 },
  { word: 'test', start: 0.5, end: 1.0 },
  { word: 'transcript', start: 1.0, end: 2.0 },
  { word: 'line.', start: 2.0, end: 3.0 },
];

test.describe('T-30: транскрибация полный путь', () => {
  test('Generate → текст → persistence (вкладки+reload) → удаление слова → маркер', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e?.stack || e)));
    page.on('console', (m) => { if (m.type() === 'error' && !/net::ERR_CONNECTION_RESET|ERR_EMPTY_RESPONSE|Failed to load resource/.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
    page.on('requestfailed', (r) => console.log('REQFAIL:', r.url().slice(0, 90), '|', r.failure()?.errorText));

    resetMockData(page);
    // фейковый движок подключается до загрузки приложения — окно __anoteeFakeTranscribe
    await page.addInitScript((words: any) => {
      (window as any).__anoteeFakeTranscribe = JSON.stringify(words);
    }, FAKE_WORDS);

    // запуск транскрибации с 2 попытками (dev-сервер может сбросить соединение — инфрафлейк)
    let wordsVisible = false;
    for (let attempt = 0; attempt < 2 && !wordsVisible; attempt++) {
      await openPlayer(page);
      await page.getByTestId('transcript-tab').click();
      const generateBtn = page.getByRole('button', { name: /Generate Transcript/i });
      await generateBtn.waitFor({ state: 'visible' });
      try { await generateBtn.click({ timeout: 3000 }); } catch {
        const probe = await page.evaluate(() => {
          let fired = false;
          const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.includes('Generate Transcript'));
          if (b) { b.addEventListener('click', () => { fired = true; }, { once: true }); b.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); }
          return { fired, disabled: b ? b.disabled : null };
        });
        console.log('PROBE:', JSON.stringify(probe));
      }
      try {
        await expect(page.getByTestId('transcript-words')).toBeVisible({ timeout: 8000 });
        wordsVisible = true;
      } catch { /* повторная попытка */ }
    }
    expect(wordsVisible, 'транскрипт должен отрендериться после Generate').toBe(true);
    await expect(page.getByTestId('transcript-word')).toHaveCount(4);

    // persistence: переключение вкладок не теряет текст
    await page.getByText('Comments').first().click();
    await page.getByTestId('transcript-tab').click();
    await expect(page.getByTestId('transcript-word')).toHaveCount(4);

    // persistence: перезагрузка страницы — текст из localStorage (после reload открываем плеер заново)
    await page.reload();
    await openPlayer(page);
    await page.getByTestId('transcript-tab').click();
    await expect(page.getByTestId('transcript-word')).toHaveCount(4);

    // выделение слова → шит → удаление
    await page.getByTestId('transcript-word').nth(1).click();
    await expect(page.getByTestId('word-sheet')).toBeVisible();
    await page.getByTestId('sel-delete').click();
    await expect(page.getByTestId('transcript-word').nth(1)).toHaveClass(/line-through/);

    // комментарий-маркер появился в списке комментариев
    await page.getByText('Comments').first().click();
    await expect(page.getByText(/Delete: «test»|Удалить: «test»/)).toBeVisible();

    // регрессия #321: никаких Invalid hook call
    expect(errors.filter((e) => /321|Invalid hook/i.test(e))).toEqual([]);
  });
});
