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

  // T-169: хранилище живёт в разделе «Настройки»
  await page.goto('/settings');
  await page.waitForTimeout(1200);

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

test('«Профиль» и «Настройки» — разные страницы, а не вкладки', async ({ page }) => {
  test.setTimeout(120_000);
  resetMockData(page);

  // страница профиля: аккаунт и подписка, хранилища нет; переключателя вкладок нет
  await page.goto('/profile');
  await page.waitForTimeout(1200);
  expect(await page.evaluate(() => location.pathname)).toBe('/profile');
  await expect(page.locator('#profile-block')).toBeVisible();
  await expect(page.getByTestId('subscription-block')).toBeVisible();
  await expect(page.locator('#storage-block')).toBeHidden();
  await expect(page.getByTestId('section-settings')).toHaveCount(0);
  await expect(page.getByTestId('section-profile')).toHaveCount(0);

  // кросс-ссылка ведёт на отдельную страницу настроек
  await page.getByTestId('profile-cross-nav').click();
  await page.waitForTimeout(900);
  expect(await page.evaluate(() => location.pathname), 'кросс-ссылка не привела на /settings').toBe('/settings');
  await expect(page.locator('#storage-block')).toBeVisible();
  await expect(page.locator('#profile-block')).toBeHidden();
  await expect(page.getByTestId('subscription-block')).toBeHidden();

  // и обратно — на страницу профиля
  await page.getByTestId('profile-cross-nav').click();
  await page.waitForTimeout(900);
  expect(await page.evaluate(() => location.pathname)).toBe('/profile');
  await expect(page.locator('#profile-block')).toBeVisible();
});

test('хранилище: у провайдеров есть свои ссылки-инструкции', async ({ page }) => {
  test.setTimeout(120_000);
  resetMockData(page);
  await page.goto('/profile');
  await page.waitForTimeout(1200);
  // T-169: ссылки-инструкции живут в разделе «Настройки»
  await page.goto('/settings');
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
