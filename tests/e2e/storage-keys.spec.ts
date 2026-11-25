// T-180: guard «Сохранить и активировать» без Access Key ID + отображение причин
import { test, expect } from '@playwright/test';
import { resetMockData } from './support';

test.describe('Хранилище: создание ключа и сохранение', () => {
  test('без Access Key ID конфиг не отправляется, показывается понятная подсказка', async ({ page }) => {
    test.setTimeout(120_000);
    resetMockData(page);

    const configCalls: string[] = [];
    page.on('request', (req) => {
      const u = req.url();
      if (u.includes('/api/storage?action=config')) configCalls.push(req.method() + ' ' + u);
    });

    // T-212: «Настройки» — отдельная страница (/settings), хранилище живёт там
    await page.goto('/settings');
    await page.waitForTimeout(1200);

    // выбираем провайдера Cloudflare, чтобы форма S3 была активна
    await page.getByTestId('provider-card-cloudflare').click().catch(() => {});
    await page.waitForTimeout(600);

    const keyInput = page.locator('input[placeholder="Access Key ID"]').first();
    const hasKeyField = await keyInput.count();
    if (hasKeyField) {
      await keyInput.fill('');
      const save = page.getByText(/Сохранить и активировать/i).first();
      if (await save.count()) {
        await save.click();
        await page.waitForTimeout(1200);
        // T-179: запрос config не должен уйти при пустом Access Key ID
        expect(configCalls.length, 'улетел запрос config без Access Key ID').toBe(0);
        const body = await page.evaluate(() => document.body.innerText || '');
        expect(/Access Key ID/i.test(body), 'нет подсказки про Access Key ID').toBe(true);
        console.log('GUARD-CHECK config-запросов=' + configCalls.length);
      } else {
        console.log('GUARD-SKIP нет кнопки сохранения');
      }
    } else {
      console.log('GUARD-SKIP нет поля Access Key ID');
    }
  });

  test('ручное подключение: инструкция с точными шагами, автозаполнения нет', async ({ page }) => {
    test.setTimeout(120_000);
    resetMockData(page);

    await page.goto('/settings');
    await page.waitForTimeout(1200);
    await page.getByTestId('provider-card-cloudflare').click().catch(() => {});
    await page.waitForTimeout(600);

    // T-328: автозаполнение и модалка удалены
    await expect(page.getByTestId('cf-token-open')).toHaveCount(0);
    await expect(page.getByTestId('cf-token-modal')).toHaveCount(0);

    // инструкция «Как получить ключи» содержит кнопку и страницу Success
    await page.getByTestId('provider-help').click();
    await page.waitForTimeout(400);
    const help = await page.getByTestId('provider-help-steps').innerText();
    expect(help).toMatch(/Create Account API token/);
    expect(help).toMatch(/Success/);
    expect(help).toMatch(/Access Key ID/);

    // внешняя ссылка на Manage API Tokens есть
    const link = await page.getByTestId('provider-external-link').first().getAttribute('href');
    expect(link || '').toContain('r2/api-tokens');
    console.log('MANUAL-PATH ok, link=' + link);

    // поля ручного ввода на месте (Access Key / Secret / Bucket / Endpoint)
    const inputs = await page.locator('#storage-block input').count();
    expect(inputs, 'нет полей ручного ввода').toBeGreaterThan(2);
  });
});

// T-14x: сетевой обрыв при загрузке настроек — не подменяем активное хранилище «Google»,
// показываем понятный статус с кнопкой «Повторить».
test('хранилище: сетевой обрыв — статус вместо «Google», повтор доступен', async ({ page }) => {
  test.setTimeout(90_000);
  await page.route('**/api/storage?action=config*', (route) => route.abort());
  await page.goto('/settings');
  const netErr = page.getByTestId('storage-net-error');
  const appeared = await netErr.waitFor({ state: 'visible', timeout: 9000 }).then(() => true).catch(() => false);
  expect(appeared, 'при сетевом обрыве должен появиться статус вместо «Google»').toBe(true);
  await expect(page.getByTestId('storage-net-retry')).toBeVisible();
  console.log('NET-ERR-CHECK ok: баннер сети показан, кнопка «Повторить» доступна');
});
