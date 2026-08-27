import { test, expect } from '@playwright/test';
import { MOCK_PROJECT_1, installSpeechRecognitionMock, openPlayer, resetMockData } from './support';

/**
 * Мобильные проверки (проект «mobile», Pixel 7 — 412×915).
 *
 * Зелёные тесты — то, что работает на мобиле СЕЙЧАС.
 * Регрессии T-08 (docs/TASKS.md) исправлены и переведены из test.fixme в обычные тесты.
 */

test.describe('Мобильные проверки, работающие сейчас (412×915)', () => {
  test.beforeEach(({ page }) => {
    resetMockData(page);
    installSpeechRecognitionMock(page);
  });

  test('бар комментария плеера: поле ввода и mic-кнопка видимы и кликабельны', async ({ page }) => {
    const input = await openPlayer(page);

    // Поле комментария в пределах вьюпорта
    await expect(input).toBeVisible();
    await expect(input).toBeEnabled();

    // Mic-кнопка в баре комментария
    const micButton = page.locator('#tour-comment-input .relative button').first();
    await expect(micButton).toBeVisible();
    await expect(micButton).toBeEnabled();

    // Кликабельность по-настоящему: фейковое распознавание кладёт текст в поле
    await micButton.click();
    await expect(input).toHaveValue('Тестовая голосовая правка', { timeout: 5_000 });
  });

  test('таймкод-панель плеера не выходит за вьюпорт', async ({ page }) => {
    await openPlayer(page);

    const timecode = page.locator('#tour-timecode');
    await expect(timecode).toBeVisible();
    await expect(timecode).toBeInViewport();
  });
});

test.describe('T-08: мобильные регрессии (исправлены, разморожены)', () => {
  test.beforeEach(({ page }) => resetMockData(page));

  test('T-08: hover-only кнопки карточек проекта видимы без наведения (Dashboard.tsx:443-474)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(MOCK_PROJECT_1).first()).toBeVisible({ timeout: 15_000 });

    const card = page.locator('.group', { hasText: MOCK_PROJECT_1 }).first();
    const lockButton = card.locator('button[title="Lock"], button[title="Unlock"]').first();

    // На <md кнопки действий всегда видимы и не «прозрачны»
    await expect(lockButton).toBeVisible();
    await expect(lockButton).toHaveCSS('opacity', '1');
  });

  test('T-08: hover-only кнопки ассетов видимы без наведения (ProjectView.tsx:679-715, 920)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(MOCK_PROJECT_1).first()).toBeVisible({ timeout: 15_000 });
    await page.getByText(MOCK_PROJECT_1).first().click();
    await expect(page.getByText('Main_Commercial_Cut')).toBeVisible({ timeout: 15_000 });

    const assetCard = page.locator('.group.cursor-pointer', { hasText: 'Main_Commercial_Cut' }).first();
    const addVersionButton = assetCard.locator('button:has(svg.lucide-history)').first();

    // Действия ассета (добавить версию и др.) доступны без hover
    await expect(addVersionButton).toBeVisible();
    await expect(addVersionButton).toHaveCSS('opacity', '1');
  });

  test('T-08: переключатель вида single/compare доступен на мобиле (Player.tsx:861)', async ({ page }) => {
    await openPlayer(page);

    // Кнопка view-switcher (иконка Monitor) в header — раньше display:none на <768px
    const viewSwitcher = page.locator('header button:has(svg.lucide-monitor)').first();
    await expect(viewSwitcher).toBeVisible();
    await expect(viewSwitcher).toBeInViewport();
  });
});
