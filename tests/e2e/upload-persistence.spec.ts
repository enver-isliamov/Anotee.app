import { test, expect } from '@playwright/test';
// (support не нужен: контекст свежий)

// T-368 (регресс): «загруженный файл исчезал после перезагрузки».
// Причина: итоговый проект «вынимался» из апдейтера setProjects, но React 18 выполняет апдейтеры
// не синхронно — переменная оставалась null, и синхронизация с сервером после загрузки пропускалась.
// Проверяем полный цикл: upload → сохранение (sync) → reload → файл на месте.

const readAssets = async (page: import('@playwright/test').Page) => {
  return await page.evaluate(() => {
    const raw = localStorage.getItem('anotee_projects_data');
    if (!raw) return { found: false, assets: [] as string[] };
    try {
      const projs = JSON.parse(raw);
      const p = (Array.isArray(projs) ? projs : []).find((x: { name?: string }) => /Commercial/.test(x.name || ''));
      if (!p) return { found: false, assets: [] as string[] };
      return { found: true, assets: (p.assets || []).map((a: { title?: string }) => a.title) };
    } catch (e) {
      return { found: false, assets: ['ERR: ' + String(e)] };
    }
  });
};

test('upload: файл сохраняется и переживает перезагрузку', async ({ page }) => {
  test.setTimeout(150_000);
  // ВАЖНО: НЕ используем resetMockData: её init script удаляет localStorage на КАЖДОЙ навигации
  // (включая reload) и мешает проверке персистентности. Контекст Playwright для каждого теста свежий.
  await page.goto('/');
  await page.waitForTimeout(1500);

  await page.getByText('Anotee – Commercial Spot X').first().click();
  await page.waitForTimeout(1200);

  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'upload-test.mp4',
    mimeType: 'video/mp4',
    buffer: Buffer.alloc(4096, 65),
  });

  // mock-загрузка ~2.2 c + превью + синхронизация
  await page.waitForTimeout(9000);

  // 1) СИНХРОНИЗАЦИЯ: файл должен попасть в «серверное» хранилище (в mock — localStorage)
  const afterUpload = await readAssets(page);
  expect(afterUpload.assets, 'после upload файл должен быть сохранён (sync вызван)').toContain('upload-test');

  // 2) UI до перезагрузки
  expect(await page.getByText('upload-test').count()).toBeGreaterThan(0);

  // 3) Перезагрузка страницы
  await page.reload();
  await page.waitForTimeout(3000);

  // Если оказались на дашборде — открыть проект
  if ((await page.getByText('upload-test').count()) === 0) {
    const proj = page.getByText('Anotee – Commercial Spot X').first();
    if ((await proj.count()) > 0) {
      await proj.click();
      await page.waitForTimeout(1500);
    }
  }

  // 4) Файл должен пережить перезагрузку
  expect(await page.getByText('upload-test').count(), 'файл должен остаться после перезагрузки').toBeGreaterThan(0);
});
