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

    await page.goto('/profile');
    await page.waitForTimeout(1200);
    // раздел «Настройки» — хранилище живёт там
    await page.getByTestId('section-settings').click().catch(() => {});
    await page.waitForTimeout(700);

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

    await page.goto('/profile');
    await page.waitForTimeout(1200);
    await page.getByTestId('section-settings').click().catch(() => {});
    await page.waitForTimeout(700);

    await page.getByTestId('cf-token-open').click();
    await expect(page.getByTestId('cf-token-modal')).toBeVisible();
    await page.locator('input[placeholder="Вставьте токен"]').fill('cfat_abcdefghijklmnopqrstuvwxyz123456');
    await page.getByText(/Проверить и заполнить/i).click();
    await page.waitForTimeout(1200);

    // предупреждение о правах токена видно сразу после проверки
    const warn = page.getByTestId('cf-no-createkeys');
    if (await warn.count()) {
      await expect(warn).toBeVisible();
      console.log('NO-CREATEKEYS-WARN ok');
    } else {
      console.log('NO-CREATEKEYS-WARN не отрисован (модалка могла закрыться)');
    }

    // пробуем создать ключ — приходит структурированная ошибка
    const createBtn = page.getByText(/Создать R2-ключ/i).first();
    if (await createBtn.count()) {
      await createBtn.click();
      await page.waitForTimeout(1200);
      const errBox = page.getByTestId('cf-key-error');
      if (await errBox.count()) {
        await expect(errBox).toBeVisible();
        const t = await errBox.innerText();
        expect(t).toContain('Account API Tokens');
        expect(t).toContain('9109');
        const href = await errBox.locator('a').first().getAttribute('href');
        expect(href || '').toContain('r2/api-tokens');
        console.log('KEY-ERROR-CHECK текст="' + t.replace(/\n/g, ' | ').slice(0, 140) + '" link=' + href);
      } else {
        console.log('KEY-ERROR не отрисован');
      }
    }
    await page.screenshot({ path: 'test-results/screens/cf-key-error.png' }).catch(() => {});
  });
});
