import { test, expect } from '@playwright/test';
import { MOCK_COMMENT_1, MOCK_PROJECT_1, openPlayer, resetMockData } from './support';

test.describe('Плеер (mock-режим)', () => {
  test.beforeEach(({ page }) => resetMockData(page));

  test('таймкод виден и форматирован (HH:MM:SS:FF + FPS)', async ({ page }) => {
    await openPlayer(page);

    const timecode = page.locator('#tour-timecode');
    await expect(timecode).toContainText(/\d{2}:\d{2}:\d{2}:\d{2}/);
    await expect(timecode).toContainText('FPS');
  });

  test('существующие комментарии версии видны в списке', async ({ page }) => {
    await openPlayer(page);

    await expect(page.getByText(MOCK_COMMENT_1).first()).toBeVisible();
  });

  test('комментарий создаётся через поле ввода и появляется в списке', async ({ page }) => {
    const input = await openPlayer(page);

    const commentText = `E2E проверка ${Date.now()}`;
    await input.click();
    // pressSequentially гарантирует реальные key-события → React onChange
    await input.pressSequentially(commentText);
    await expect(input).toHaveValue(commentText);

    // Кнопка отправки — прямой потомок бара комментария (иконка Send)
    await page.locator('#tour-comment-input > button').click();

    // Появился в списке комментариев
    await expect(page.getByText(commentText).first()).toBeVisible();

    // Поле очистилось
    await expect(input).toHaveValue('');
  });
});
