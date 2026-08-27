import { test, expect } from '@playwright/test';
import { installSpeechRecognitionMock, openPlayer, resetMockData } from './support';

const TRANSCRIPT = 'Тестовая голосовая правка';

test.describe('Голосовой ввод (mock SpeechRecognition)', () => {
  test.beforeEach(({ page }) => {
    resetMockData(page);
    installSpeechRecognitionMock(page, TRANSCRIPT);
  });

  test('клик по микрофону в поле комментария → transcript попадает в input', async ({ page }) => {
    const input = await openPlayer(page);

    // Mic-кнопка внутри поля комментария (вложенная в .relative обёртку input'а)
    const micButton = page.locator('#tour-comment-input .relative button').first();
    await expect(micButton).toBeVisible();
    await micButton.click();

    // Фейковое распознавание через ~200мс отдаёт transcript в поле ввода
    await expect(input).toHaveValue(TRANSCRIPT, { timeout: 5_000 });
  });

  test('полный путь: голос → input → отправка → комментарий в списке', async ({ page }) => {
    const input = await openPlayer(page);

    await page.locator('#tour-comment-input .relative button').first().click();
    await expect(input).toHaveValue(TRANSCRIPT, { timeout: 5_000 });

    await page.locator('#tour-comment-input > button').click();

    // Комментарий с текстом из transcript появился в списке
    await expect(page.getByText(TRANSCRIPT).first()).toBeVisible();
  });
});
