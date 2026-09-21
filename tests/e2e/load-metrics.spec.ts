import { test, expect } from '@playwright/test';
import { resetMockData } from './support';

// T-155: метрики загрузки (доказательство эффекта оптимизации бандла)
test('метрики загрузки первой страницы', async ({ page }) => {
  test.setTimeout(120_000);
  resetMockData(page);
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  const m = await page.evaluate(() => {
    const nav: any = performance.getEntriesByType('navigation')[0] || {};
    const res = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const jsBytes = res
      .filter((r) => /\.js(\?|$)/.test(r.name))
      .reduce((s, r) => s + (r.transferSize || r.encodedBodySize || 0), 0);
    const jsCount = res.filter((r) => /\.js(\?|$)/.test(r.name)).length;
    const fcp = (performance.getEntriesByName('first-contentful-paint')[0] as any)?.startTime || 0;
    return {
      domContentLoaded: Math.round(nav.domContentLoadedEventEnd || 0),
      load: Math.round(nav.loadEventEnd || 0),
      fcp: Math.round(fcp),
      jsCount,
      jsKB: Math.round(jsBytes / 1024)
    };
  });
  console.log('LOAD-METRICS ' + JSON.stringify(m));
  expect(m.load, 'страница не загрузилась').toBeGreaterThan(0);
  expect(m.jsKB, 'не найден JS в ресурсах').toBeGreaterThan(0);
});
