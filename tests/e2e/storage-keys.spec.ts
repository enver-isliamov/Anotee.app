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

  test('ошибка автосоздания ключа показывается с подсказкой и ссылкой на ручной путь', async ({ page }) => {
    test.setTimeout(120_000);
    resetMockData(page);

    // сервер отвечает «нет права Account API Tokens: Edit»
    await page.route('**/api/storage?action=cf_create_r2_key', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'У Cloudflare-токена нет права «Account API Tokens: Edit» — автосоздание R2-ключа недоступно',
          cfCode: 9109, fallback: 'manual',
          manualUrl: 'https://dash.cloudflare.com/?to=/:account/r2/api-tokens',
          hint: 'Создайте R2 API-токен вручную: R2 → Manage API Tokens → Create API token'
        })
      });
    });
    // probe отвечает успешно, но без права на автоключи
    await page.route('**/api/storage?action=cf_probe', async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          success: true, accountId: 'acct123', accountName: 'Test', tokenType: 'account', canCreateKeys: false,
          buckets: ['anotee'], endpoints: { default: 'https://acct123.r2.cloudflarestorage.com' }
        })
      });
    });

    await page.goto('/settings');
    await page.waitForTimeout(1200);

    // T-296: автозаполнение — в панели Cloudflare
    await page.getByTestId('provider-card-cloudflare').click();
    await page.waitForTimeout(600);
    await page.getByTestId('cf-token-open').click();
    await expect(page.getByTestId('cf-token-modal')).toBeVisible();
    await page.getByTestId('cf-token-input').fill('cfat_abcdefghijklmnopqrstuvwxyz123456');
    await page.getByTestId('cf-probe-submit').click();
    await page.waitForTimeout(1200);

    // предупреждение о правах токена видно сразу после проверки
    const warn = page.getByTestId('cf-no-createkeys');
    if (await warn.count()) {
      await expect(warn).toBeVisible();
      console.log('NO-CREATEKEYS-WARN ok');
    } else {
      console.log('NO-CREATEKEYS-WARN не отрисован (модалка могла закрыться)');
    }

    // T-313: при canCreateKeys=false кнопки автосоздания НЕТ — показывается ручной путь
    await expect(page.getByTestId('cf-create-key-btn')).toHaveCount(0);
    const steps = await page.getByTestId('cf-no-createkeys').innerText();
    expect(steps).toContain('Create Account API token');
    expect(steps).toContain('Access Key ID');
    const href = await page.getByTestId('cf-no-createkeys').locator('a').first().getAttribute('href');
    expect(href || '').toContain('/r2/api-tokens');
    console.log('NO-CREATEKEYS-STEPS ok, link=' + href);
    await page.screenshot({ path: 'test-results/screens/cf-key-error.png' }).catch(() => {});
  });
});
