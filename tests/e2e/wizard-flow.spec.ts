import { test, expect } from '@playwright/test';
import { resetMockData } from './support';

// T-82: мастер R2 — триггер доступен, шаги переключаются, кнопка автонастройки требует ключи
test('wizard: open -> step1 -> step2 -> step3 checklist renders', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e?.stack || e)));

  resetMockData(page);
  await page.goto('/');
  await page.waitForTimeout(1200);

  // открыть профиль (тур-кнопка или прямой путь)
  const profileBtn = page.locator('[data-testid="tour-profile-btn"], [title*="рофил"], [title*="Profile"]');
  if (await profileBtn.count()) { await profileBtn.first().click(); }
  else { await page.goto('/profile'); }
  await page.waitForTimeout(800);

  // триггер мастера
  const open = page.getByTestId('wizard-open');
  await expect(open).toBeVisible();
  await open.click();

  const overlay = page.getByTestId('wizard-overlay');
  await expect(overlay).toBeVisible();
  await expect(overlay.getByText('Шаг 1 из 3')).toBeVisible();

  await overlay.getByRole('button', { name: /Ключи готовы/ }).click();
  await expect(overlay.getByText('Шаг 2 из 3')).toBeVisible();

  const goBtn = overlay.getByRole('button', { name: /Подключить и проверить/ });
  await expect(goBtn).toBeDisabled();

  const akInput = overlay.locator('input').nth(0);
  const skInput = overlay.locator('input[type="password"]');
  await akInput.fill('test-access-key-1234567890');
  await skInput.fill('test-secret-key-abcdefghijklmnopqrstuvwxyz0987654321');
  await overlay.locator('input').nth(2).fill('anotee');
  await expect(goBtn).toBeEnabled();

  await goBtn.click();
  await expect(overlay.getByText('Проверка ключей')).toBeVisible();
  await expect(overlay.getByText('Сохранение конфига')).toBeVisible();

  // после автонастройки (мок-среда: API вернёт ошибку — чек-лист должен остаться честным, без фейкового успеха)
  await page.waitForTimeout(2500);
  expect(errors.filter(e => /not a function/.test(e)), 'нет крашей рендера').toEqual([]);
});
