import { test, expect } from '@playwright/test';
import { resetMockData } from './support';

// T-121: модалка «Заполнить по Cloudflare-токену» — оба типа токенов, поле Account ID
test('cloudflare token modal: opens, has token + Account ID fields, hints for cfat_', async ({ page }) => {
  test.setTimeout(90_000);
  resetMockData(page);
  await page.goto('/');
  await page.waitForTimeout(1200);

  const profileBtn = page.locator('[data-testid="tour-profile-btn"], [title*="рофил"], [title*="Profile"]');
  if (await profileBtn.count()) { await profileBtn.first().click(); } else { await page.goto('/profile'); }
  await page.waitForTimeout(800);

  await page.getByText('🔑 Заполнить по Cloudflare-токену').first().click();
  await expect(page.getByTestId('cf-token-modal')).toBeVisible();
  await expect(page.getByTestId('cf-account-id')).toBeVisible();

  // ввод Account-токена (cfat_) без Account ID → должна появиться подсказка
  const tokenInput = page.locator('input[placeholder="Вставьте токен"]');
  await tokenInput.fill('cfat_abcdefghijklmnopqrstuvwxyz1234567890');
  await expect(page.getByText(/обязательно укажите Account ID/i)).toBeVisible();
});
