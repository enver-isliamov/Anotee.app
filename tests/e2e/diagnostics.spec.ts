import { test, expect } from '@playwright/test';
import { resetMockData } from './support';

test.describe('System Diagnostics (/test)', () => {
  test.beforeEach(({ page }) => resetMockData(page));

  test('страница диагностики открывается и Run Full Suite выполняется', async ({ page }) => {
    await page.goto('/test');

    await expect(page.getByRole('heading', { name: 'System Diagnostics' })).toBeVisible({ timeout: 15_000 });

    const runButton = page.getByRole('button', { name: 'Run Full Suite' });
    await expect(runButton).toBeVisible();
    await runButton.click();

    // Статус выполнения виден (кнопка переходит в Running...)
    await expect(page.getByRole('button', { name: 'Running...' })).toBeVisible({ timeout: 10_000 });

    // Сьют завершается: отчёт в консоли + кнопка вернулась
    await expect(page.getByText('>>> DIAGNOSTIC COMPLETE.')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('button', { name: 'Run Full Suite' })).toBeVisible();

    // Результаты групп отрендерены (бейджи «N/N» на карточках групп)
    await expect(page.getByText('Executive Summary')).toBeVisible();
    await expect(page.getByText('Total', { exact: true })).toBeVisible();
  });
});
