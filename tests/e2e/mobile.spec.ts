import { test, expect } from '@playwright/test';
import { MOCK_PROJECT_1, installSpeechRecognitionMock, openPlayer, resetMockData } from './support';

/**
 * Мобильные регрессии (проект «mobile», Pixel 7 — 412×915).
 *
 * Зелёные тесты — то, что работает на мобиле СЕЙЧАС.
 * test.fixme('T-08: ...', body) — известные регрессии из docs/TASKS.md T-08:
 * сьют остаётся зелёным, задача не теряется (в отчёте — fixme с телом-спецификацией).
 * После фикса T-08 перевести в обычные тесты.
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

test.describe('T-08: мобильные регрессии (сейчас красные — зафиксированы как fixme)', () => {
  test.beforeEach(({ page }) => resetMockData(page));

  test.fixme('T-08: hover-only кнопки карточек проекта недоступны без наведения (Dashboard.tsx:443-474)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(MOCK_PROJECT_1).first()).toBeVisible({ timeout: 15_000 });

    const card = page.locator('.group', { hasText: MOCK_PROJECT_1 }).first();
    const lockButton = card.locator('button[title="Lock"], button[title="Unlock"]').first();

    // После фикса: кнопки действий должны быть видимы и не «прозрачны» на <md
    await expect(lockButton).toBeVisible();
    await expect(lockButton).toHaveCSS('opacity', '1');
  });

  test.fixme('T-08: hover-only кнопки ассетов недоступны без наведения (ProjectView.tsx:679-715, 920)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(MOCK_PROJECT_1).first()).toBeVisible({ timeout: 15_000 });
    await page.getByText(MOCK_PROJECT_1).first().click();
    await expect(page.getByText('Main_Commercial_Cut')).toBeVisible({ timeout: 15_000 });

    const assetCard = page.locator('.group.cursor-pointer', { hasText: 'Main_Commercial_Cut' }).first();
    const addVersionButton = assetCard.locator('button:has(svg.lucide-history)').first();

    // После фикса: действия ассета (добавить версию и др.) доступны без hover
    await expect(addVersionButton).toBeVisible();
    await expect(addVersionButton).toHaveCSS('opacity', '1');
  });

  test.fixme('T-08: переключатель вида single/compare скрыт на мобиле (Player.tsx:861, hidden md:block)', async ({ page }) => {
    await openPlayer(page);

    // Кнопка view-switcher (иконка Monitor) внутри header-обёртки `hidden md:block`:
    // сейчас display:none на <768px, после фикса должна быть видима
    const viewSwitcher = page.locator('header button:has(svg.lucide-monitor)').first();
    await expect(viewSwitcher).toBeVisible();
  });
});
