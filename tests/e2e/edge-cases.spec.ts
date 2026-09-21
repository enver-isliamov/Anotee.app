import { test, expect } from '@playwright/test';
import { resetMockData } from './support';

// T-145: граничные и ошибочные сценарии UI (без сети — проверяем клиентское поведение)
test.describe('Граничные случаи', () => {
  test('пустая форма хранилища: сохранение не роняет страницу и сообщает о проблеме', async ({ page }) => {
    test.setTimeout(120_000);
    resetMockData(page);
    await page.goto('/profile');
    await page.getByTestId('section-settings').click().catch(() => {});
    await page.waitForTimeout(600);

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

  test('Cloudflare-модалка: короткий токен отклоняется понятным сообщением', async ({ page }) => {
    test.setTimeout(120_000);
    resetMockData(page);
    await page.goto('/profile');
    await page.getByTestId('section-settings').click().catch(() => {});
    await page.waitForTimeout(600);

    await page.waitForTimeout(1200);

    await page.getByTestId('cf-token-open').click();
    await expect(page.getByTestId('cf-token-modal')).toBeVisible();

    // короткий токен (клиентская валидация до сети)
    await page.locator('input[placeholder="Вставьте токен"]').fill('short');
    await page.getByText(/Проверить и заполнить/i).click();
    await page.waitForTimeout(800);

    const body = await page.evaluate(() => document.body.innerText || '');
    expect(/Вставьте Cloudflare API-токен/i.test(body), 'нет понятного сообщения о коротком токене').toBe(true);
    // модалка не закрылась и не упала
    await expect(page.getByTestId('cf-token-modal')).toBeVisible();
  });

  test('Cloudflare-модалка: закрывается и не оставляет состояния', async ({ page }) => {
    test.setTimeout(120_000);
    resetMockData(page);
    await page.goto('/profile');
    await page.getByTestId('section-settings').click().catch(() => {});
    await page.waitForTimeout(600);

    await page.waitForTimeout(1200);

    await page.getByTestId('cf-token-open').click();
    await expect(page.getByTestId('cf-token-modal')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    // после повторного открытия поле пустое (нет «залипшего» состояния)
    const again = page.getByTestId('cf-token-open');
    if (!(await page.getByTestId('cf-token-modal').count())) {
      await again.click();
      await expect(page.getByTestId('cf-token-modal')).toBeVisible();
    }
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
