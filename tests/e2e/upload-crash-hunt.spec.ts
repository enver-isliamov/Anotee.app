import { test, expect } from '@playwright/test';
import { resetMockData } from './support';

// T-62: воспроизведение краша «j is not a function» при загрузке видео (реальный рендер optimistic-версии)
test('upload: выбор файла в ProjectView не роняет рендер (crash hunt)', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e?.stack || e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/net::|Failed to load resource/.test(m.text())) errors.push('CONSOLE: ' + m.text()); });

  resetMockData(page);
  await page.goto('/');
  await page.waitForTimeout(1200);

  // открыть проект (мок-проект из дашборда)
  await page.getByText('Commercial').first().click();
  await page.waitForTimeout(1200);

  // в ProjectView: клик по кнопке добавления версии (открывает скрытый input)
  const addBtn = page.getByTestId('add-version');
  if (await addBtn.count()) { await addBtn.first().click(); } else {
    await page.locator('input[type="file"]').first().setInputFiles({ name: 'crash-hunt.mp4', mimeType: 'video/mp4', buffer: Buffer.from('AAAA' + 'B'.repeat(1024), 'utf8') });
  }
  await page.waitForTimeout(3000);

  const crash = errors.filter(e => /not a function|is not defined/.test(e));
  if (crash.length) {
    console.log('=== CRASH STACK (dev, читаемый) ===');
    crash.slice(0, 3).forEach(c => console.log(c.split('\n').slice(0, 8).join('\n')));
  }
  const fatal = errors.filter(e => /not a function/.test(e));
  expect(fatal, 'краш рендера при загрузке: ' + (fatal[0] || '').split('\n')[0]).toEqual([]);
});
