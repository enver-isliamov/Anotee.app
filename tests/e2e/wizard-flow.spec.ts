import { test, expect } from '@playwright/test';
import { resetMockData } from './support';

// T-133: новый поток подключения хранилища (мастер в 3 шага удалён)
test('хранилище: без мастера, есть подключение по токену и ссылки-инструкции', async ({ page }) => {
  test.setTimeout(120_000);
  resetMockData(page);
  await page.goto('/');
  await page.waitForTimeout(1200);
  const profileBtn = page.locator('[data-testid="tour-profile-btn"], [title*="рофил"], [title*="Profile"]');
  if (await profileBtn.count()) { await profileBtn.first().click(); } else { await page.goto('/profile'); }
  await page.waitForTimeout(1000);

  // мастера больше нет
  await expect(page.getByTestId('wizard-open')).toHaveCount(0);
  await expect(page.getByTestId('wizard-overlay')).toHaveCount(0);

  // карточки провайдеров и кнопка подключения по токену
  await expect(page.getByTestId('provider-card-cloudflare')).toBeVisible();
  const cfBtn = page.getByTestId('cf-token-open');
  await expect(cfBtn).toBeVisible();
  await cfBtn.click();
  await expect(page.getByTestId('cf-token-modal')).toBeVisible();
  await expect(page.getByText(/Создать Account API Token/i)).toBeVisible();
  await expect(page.getByText(/Скопировать Account ID/i)).toBeVisible();
});

test('хранилище: у провайдеров есть свои ссылки-инструкции', async ({ page }) => {
  test.setTimeout(120_000);
  resetMockData(page);
  await page.goto('/profile');
  await page.waitForTimeout(1200);
  for (const pid of ['yandex', 'cloudflare', 'selectel']) {
    const card = page.getByTestId('provider-card-' + pid);
    if (await card.count()) {
      await card.click();
      await page.waitForTimeout(700);
      const links = await page.locator('a[target="_blank"]').evaluateAll((els) => els.map((e) => e.getAttribute('href') || ''));
      expect(links.length, pid + ': нет ссылок-инструкций').toBeGreaterThan(0);
    }
  }
});
