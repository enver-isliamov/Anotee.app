import { test, expect } from '@playwright/test';
import { MOCK_PROJECT_1, resetMockData } from './support';

test.describe('Дашборд (mock-режим)', () => {
  test.beforeEach(({ page }) => resetMockData(page));

  test('mock-проекты из constants.ts видны', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('My Projects').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(MOCK_PROJECT_1)).toBeVisible();
    await expect(page.getByText('Social Reels (Vertical)')).toBeVisible();
  });

  test('существующий проект открывается: карточки ассетов доступны', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(MOCK_PROJECT_1).first()).toBeVisible({ timeout: 15_000 });

    await page.getByText(MOCK_PROJECT_1).first().click();

    await expect(page.getByText('Main_Commercial_Cut')).toBeVisible({ timeout: 15_000 });
  });
});
