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
      lang = "";
      continuous = false;
      interimResults = false;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      // Форма как в реальном Web Speech API: results[i] — SpeechRecognitionResult
      // (имеет isFinal) c альтернативой results[i][0].transcript.
      onresult: ((event: { resultIndex: number; results: { length: number } & Record<number, { isFinal?: boolean; 0: { transcript: string } }> }) => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;
      _aborted = false;

      start() {
        this.onstart?.();
        setTimeout(() => {
          if (this._aborted) return;
          // 1) interim-результат (без isFinal — как в реальном API)
          this.onresult?.({ resultIndex: 0, results: { 0: { isFinal: false, 0: { transcript: phrase } }, length: 1 } });
          // 2) тот же результат становится финальным
          this.onresult?.({ resultIndex: 0, results: { 0: { isFinal: true, 0: { transcript: phrase } }, length: 1 } });
          // continuous=true (push-to-talk) — сессия живёт до stop()/abort(), как в реальном API;
          // continuous=false (sidebar/VoiceModal) — авто-завершение после результата
          if (!this.continuous) this.onend?.();
        }, 200);
      }
      stop() {
        this._aborted = true;
        this.onend?.();
      }
      abort() {
        this._aborted = true;
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

/**
 * Мокает HTMLMediaElement для жестовых тестов (T-18):
 *  - duration фиксированный (внешние видео mock-проектов в песочнице не грузятся —
 *    duration остаётся NaN, скрабу нечем считаться);
 *  - currentTime хранится в JS-WeakMap (детерминированное чтение без реального media pipeline);
 *  - видео-запросы абортятся СРАЗУ: media-error срабатывает рано и один раз
 *    (videoError-оверлей z-50 перекрывает video-scrub-overlay и перехватывает реальные клики),
 *    после dispatchVideoLoadedMetadata onLoadedMetadata-обработчик делает setVideoError(false).
 * Вызывать ДО page.goto (addInitScript + page.route). После открытия плеера — dispatchVideoLoadedMetadata.
 */
export const installVideoMock = async (page: Page, duration = 100) => {
  await page.route('**/*.mp4', (route) => route.abort());
  page.addInitScript((dur: number) => {
    const mediaProto = HTMLMediaElement.prototype as unknown as Record<string, PropertyDescriptor>;
    const currentTimes = new WeakMap<HTMLMediaElement, number>();
    Object.defineProperty(mediaProto, 'duration', {
      configurable: true,
      get(this: HTMLMediaElement) { return dur; },
    });
    Object.defineProperty(mediaProto, 'currentTime', {
      configurable: true,
      get(this: HTMLMediaElement) { return currentTimes.get(this) ?? 0; },
      set(this: HTMLMediaElement, value: number) { currentTimes.set(this, value); },
    });
  }, duration);
};

/**
 * Заставляет Player принять mock-duration: React 18 не диспатчит synthetic
 * 'loadedmetadata' в onLoadedMetadata (проверено эмпирически — media-listener'ы
 * не ловят несистемные события), поэтому вызываем проп-обработчик напрямую через
 * `__reactProps$` (тот же механизм, что у React Testing Library).
 * Вызывать ПОСЛЕ openPlayer.
 */
export const dispatchVideoLoadedMetadata = async (page: Page) => {
  await page.evaluate(() => {
    const video = document.querySelector('video') as HTMLVideoElement | null;
    if (!video) throw new Error('video element not found');
    const propsKey = Object.keys(video).find((k) => k.startsWith('__reactProps$'));
    if (!propsKey) throw new Error('react props not found on video');
    const props = video as unknown as Record<string, any>;
    props[propsKey].onLoadedMetadata({ currentTarget: video });
  });
};

/** Текущее currentTime первого <video> на странице (через замоканный геттер). */
export const getVideoCurrentTime = (page: Page) =>
  page.evaluate(() => (document.querySelector('video') as HTMLVideoElement | null)?.currentTime ?? -1);

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
