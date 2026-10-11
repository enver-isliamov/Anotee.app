import { test, expect } from '@playwright/test';

/**
 * T-21: гостевая ссылка /v/<token> — просмотр одной версии без регистрации.
 * В mock-режиме PublicViewer рендерит демо-данные без сети (токен не проверяется).
 */
test.describe('T-21: гостевой публичный просмотр', () => {
  test('страница /v/<token> открывается без регистрации: версия + комментарии, без навигации по проекту', async ({ page }) => {
    await page.goto('/v/demotoken1234567890abcd');

    await expect(page.getByTestId('public-viewer')).toBeVisible();
    await expect(page.getByText('Anotee – Commercial Spot X')).toBeVisible();
    await expect(page.getByText('Guest')).toBeVisible();

    // Комментарии версии доступны гостю (read-only)
    await expect(page.getByTestId('public-comments')).toBeVisible();
    await expect(page.getByText('The color grading here feels too cold')).toBeVisible();

    // Навигации по проекту нет: ни дашборда, ни переходов в другие разделы
    await expect(page.getByTestId('public-viewer-error')).toHaveCount(0);
    await expect(page.locator('button:has-text("New Project")')).toHaveCount(0);

    // T-369: гость может оставить комментарий (в mock-режиме — локально, без сети)
    await page.getByTestId('guest-comment-name').fill('Клиент');
    await page.getByTestId('guest-comment-text').fill('Поправьте титры на этом моменте');
    await page.getByTestId('guest-comment-send').click();
    await expect(page.getByText('Поправьте титры на этом моменте')).toBeVisible();
    await expect(page.getByText('Клиент')).toBeVisible();
  });
});
