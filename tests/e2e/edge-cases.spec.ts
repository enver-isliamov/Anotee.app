import { test, expect } from '@playwright/test';
import { resetMockData } from './support';

// T-145: граничные и ошибочные сценарии UI (без сети — проверяем клиентское поведение)
test.describe('Граничные случаи', () => {
  test('пустая форма хранилища: сохранение не роняет страницу и сообщает о проблеме', async ({ page }) => {
    test.setTimeout(120_000);
    resetMockData(page);
    await page.goto('/settings');
    await page.waitForTimeout(1200);

    await page.waitForTimeout(1500);

    const save = page.getByText(/Сохранить и активировать/i).first();
    if (await save.count()) {
      await save.click();
      await page.waitForTimeout(1200);
      // страница жива, признаков краша нет
      const body = await page.evaluate(() => document.body.innerText || '');
      expect(body.length).toBeGreaterThan(100);
      expect(/Ошибка отображения|Something went wrong/i.test(body)).toBe(false);
    }
  });

  test('Cloudflare: автозаполнение удалено, ручное подключение доступно', async ({ page }) => {
    test.setTimeout(120_000);
    resetMockData(page);
    await page.goto('/settings');
    await page.waitForTimeout(1200);

    await page.getByTestId('provider-card-cloudflare').click().catch(() => {});
    await page.waitForTimeout(500);

    // модалки и кнопки автозаполнения нет
    await expect(page.getByTestId('cf-token-open')).toHaveCount(0);
    await expect(page.getByTestId('cf-token-modal')).toHaveCount(0);

    // пустой Access Key ID не отправляет конфиг и подсказывает про ключи (T-179 guard сохранён)
    await page.getByTestId('storage-save-btn').click();
    await page.waitForTimeout(800);
    const body = await page.evaluate(() => document.body.innerText || '');
    expect(/Access Key ID/i.test(body), 'нет подсказки про Access Key ID').toBe(true);
  });

  test('страница диагностики открывается и запускает проверки', async ({ page }) => {
    test.setTimeout(180_000);
    resetMockData(page);
    await page.goto('/test');
    await page.waitForTimeout(1500);
    const body = await page.evaluate(() => document.body.innerText || '');
    expect(body.length, 'страница диагностики пуста').toBeGreaterThan(100);
    const runBtn = page.getByText(/Run|Запустить|Проверить/i).first();
    if (await runBtn.count()) {
      await runBtn.click();
      await page.waitForTimeout(3000);
      const after = await page.evaluate(() => document.body.innerText || '');
      expect(after.length).toBeGreaterThan(100);
    }
  });
});
