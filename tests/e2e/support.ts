import { Page, expect } from '@playwright/test';

/**
 * Общие хелперы для e2e (mock-режим: VITE_CLERK_PUBLISHABLE_KEY не задаётся,
 * приложение само «логинит» mock-user, проекты — MOCK_PROJECTS из constants.ts).
 */

export const MOCK_PROJECT_1 = 'Anotee – Commercial Spot X';
export const MOCK_ASSET_1 = 'Main_Commercial_Cut';
/** Существующий комментарий v2 из MOCK_PROJECTS. */
export const MOCK_COMMENT_1 = 'The color grading here feels too cold';

/**
 * Сбрасывает локальные данные проектов ДО старта приложения,
 * чтобы каждый тест начинался с чистых MOCK_PROJECTS.
 */
export const resetMockData = (page: Page) => {
  page.addInitScript(() => {
    window.localStorage.removeItem('anotee_projects_data');
  });
};

/**
 * Фейковый SpeechRecognition: start() → ~200мс → onresult (interim, затем final)
 * + onend — как в реальном Web Speech API (resultIndex, isFinal).
 */
export const installSpeechRecognitionMock = (page: Page, transcript = 'Тестовая голосовая правка') => {
  page.addInitScript((phrase: string) => {
    class FakeSpeechRecognition {
      lang = '';
      continuous = false;
      interimResults = false;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onresult: ((event: { resultIndex: number; results: Array<Array<{ transcript: string; isFinal?: boolean }>> }) => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;

      start() {
        this.onstart?.();
        setTimeout(() => {
          // 1) interim-результат (без isFinal — как в реальном API)
          this.onresult?.({ resultIndex: 0, results: [[{ transcript: phrase }]] });
          // 2) тот же результат становится финальным
          this.onresult?.({ resultIndex: 0, results: [[{ transcript: phrase, isFinal: true }]] });
          this.onend?.();
        }, 200);
      }
      stop() {
        this.onend?.();
      }
      abort() {
        this.onend?.();
      }
    }
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = FakeSpeechRecognition;
    (window as unknown as Record<string, unknown>).SpeechRecognition = FakeSpeechRecognition;
  }, transcript);
};

/** Дашборд → проект → плеер. Возвращает локатор поля комментария. */
export const openPlayer = async (page: Page) => {
  await page.goto('/');
  await expect(page.getByText(MOCK_PROJECT_1).first()).toBeVisible({ timeout: 15_000 });
  await page.getByText(MOCK_PROJECT_1).first().click();

  await expect(page.getByText(MOCK_ASSET_1).first()).toBeVisible();
  await page.getByText(MOCK_ASSET_1).first().click();

  // Плеер: таймкод-панель видна
  await expect(page.locator('#tour-timecode')).toBeVisible();

  return page.locator('#tour-comment-input input');
};

/** Собирает критические ошибки страницы (uncaught exceptions). */
export const collectPageErrors = (page: Page) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  return errors;
};

/**
 * Критические ошибки консоли. Ошибки загрузки ресурсов (сеть/CDN/картинки)
 * не считаются критическими — в песочнице и CI внешние хосты недоступны.
 */
export const collectCriticalConsoleErrors = (page: Page) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (/Failed to load resource/i.test(text)) return;
    if (/net::|ERR_/i.test(text)) return;
    errors.push(text);
  });
  return errors;
};
