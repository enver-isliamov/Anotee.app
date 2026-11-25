import { test, expect } from '@playwright/test';
import { collectCriticalConsoleErrors, collectPageErrors, resetMockData } from './support';

test.describe('Лендинг (mock-режим)', () => {
  test.beforeEach(({ page }) => resetMockData(page));

  test('корневая страница рендерится: приложение инициализируется и mock-вход выполнен автоматически', async ({ page }) => {
    const pageErrors = collectPageErrors(page);

    await page.goto('/');

    // Mock-режим: пользователь уже «вошёл» (mock-user) → сразу рабочая область
    await expect(page.getByText('My Projects').first()).toBeVisible({ timeout: 15_000 });
    // Индикатор mock/preview-режима
    await expect(page.getByText('PREVIEW MODE')).toBeVisible();

    expect(pageErrors, 'никаких uncaught-исключений при старте').toEqual([]);
  });

  test('нет критических ошибок консоли при загрузке и навигации', async ({ page }) => {
    const consoleErrors = collectCriticalConsoleErrors(page);

    await page.goto('/');
    await expect(page.getByText('My Projects').first()).toBeVisible({ timeout: 15_000 });

    // Публичные страницы рендерятся без критических ошибок
    await page.goto('/about');
    await expect(page.locator('body')).toContainText('Anotee', { timeout: 15_000 });

    expect(consoleErrors, 'консоль без критических ошибок').toEqual([]);
  });
});
