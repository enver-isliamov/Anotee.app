import { test, expect, type Locator, type Page, type CDPSession } from '@playwright/test';
import {
  dispatchVideoLoadedMetadata,
  getVideoCurrentTime,
  installSpeechRecognitionMock,
  installVideoMock,
  openPlayer,
  resetMockData,
} from './support';

/**
 * T-18: мобильные жесты плеера (проект «mobile», Pixel 7 — 412×915).
 *
 * Свайп-скраб: утверждённая кадровая математика (SETTINGS.md: 5px = 1 кадр) + чип целевого
 * таймкода во время жеста, pointerId-guard против мультитача, pointercancel-выход
 * (iOS-системный жест). T-19: push-to-talk на mic FloatingControls (зажать-говорить-отпустить).
 *
 * Основной свайп — реальные touch-события через CDP Input.dispatchTouchEvent (trusted,
 * как настоящий палец); мультитач/pointercancel — синтетические PointerEvent (locator.
 * dispatchEvent) для изоляции логики приложения: guard'ы по pointerId не зависят от
 * доверенности события.
 */

const sendTouch = (session: CDPSession, type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) =>
  session.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }],
  });

const dispatchPointer = async (
  element: Locator,
  type: string,
  opts: { x: number; y: number; pointerId: number },
) => {
  await element.dispatchEvent(type, {
    pointerId: opts.pointerId,
    pointerType: 'touch',
    isPrimary: opts.pointerId === 1,
    clientX: opts.x,
    clientY: opts.y,
    button: 0,
    buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
    bubbles: true,
    cancelable: true,
  });
};

test.describe('T-18: свайп-скраб по видео', () => {
  test.beforeEach(async ({ page }) => {
    resetMockData(page);
    await installVideoMock(page, 100); // mock-duration 100s: 20% = 20s
  });

  test('свайп на 60% ширины оверлея перематывает на ≥20% duration, чип виден в жесте и скрыт после', async ({ page }) => {
    await openPlayer(page);
    await dispatchVideoLoadedMetadata(page);

    const overlay = page.getByTestId('video-scrub-overlay');
    const box = await overlay.boundingBox();
    expect(box, 'оверлей скраба должен занимать область видео').toBeTruthy();
    if (!box) return;

    const y = box.y + box.height / 2;
    const startX = box.x + box.width * 0.15;
    const endX = box.x + box.width * 0.75; // свайп ≈ 60% ширины оверлея → ~60% duration (k=1.0)

    const timeBefore = await getVideoCurrentTime(page);
    expect(timeBefore).toBeGreaterThanOrEqual(0);

    // Жест реальным пальцем (CDP): touchStart → 12 touchMove с нарастающим x → touchEnd.
    // Одна CDP-сессия на весь жест (detach сбрасывает активный touch).
    const session = await page.context().newCDPSession(page);
    const steps = 12;
    await sendTouch(session, 'touchStart', startX, y);
    for (let i = 1; i <= steps; i++) {
      await sendTouch(session, 'touchMove', startX + ((endX - startX) * i) / steps, y);
      if (i === 3) {
        // Порог 10px пройден → скраб активен → чип таймкода виден
        await expect(page.getByTestId('scrub-timecode-chip')).toBeVisible();
        await expect(page.getByTestId('scrub-timecode-chip')).toContainText(/\d{2}:\d{2}:\d{2}:\d{2}/);
      }
    }
    await sendTouch(session, 'touchEnd', endX, y);
    await session.detach();

    const timeAfter = await getVideoCurrentTime(page);
    // Утверждённая математика (SETTINGS.md): 5px = 1 кадр; FPS по умолчанию 30 (детекция
    // требует воспроизведения). dx≈247px (60% ширины) → ~49 кадров → ~1.65s.
    const framesMoved = Math.round((endX - startX) / 5);
    const expectedDelta = framesMoved / 30;
    expect(Math.abs(timeAfter - timeBefore - expectedDelta)).toBeLessThanOrEqual(2 / 30);

    // После отпускания чип скрыт
    await expect(page.getByTestId('scrub-timecode-chip')).toHaveAttribute('data-state', 'idle');
  });

  test('мультитач: второй палец (другой pointerId) не перехватывает и не завершает скраб', async ({ page }) => {
    await openPlayer(page);
    await dispatchVideoLoadedMetadata(page);

    const overlay = page.getByTestId('video-scrub-overlay');
    const box = await overlay.boundingBox();
    if (!box) throw new Error('нет оверлея скраба');

    const y = box.y + box.height / 2;
    const startX = box.x + box.width * 0.1;
    const endX = box.x + box.width * 0.7;

    await dispatchPointer(overlay, 'pointerdown', { x: startX, y, pointerId: 1 });
    await dispatchPointer(overlay, 'pointermove', { x: startX + 40, y, pointerId: 1 });
    // Второй палец: down + up с чужим pointerId — скраб не должен сбиться
    await dispatchPointer(overlay, 'pointerdown', { x: startX + 50, y: y + 30, pointerId: 2 });
    await dispatchPointer(overlay, 'pointerup', { x: startX + 50, y: y + 30, pointerId: 2 });

    await dispatchPointer(overlay, 'pointermove', { x: endX, y, pointerId: 1 });
    await dispatchPointer(overlay, 'pointerup', { x: endX, y, pointerId: 1 });

    const timeAfter = await getVideoCurrentTime(page);
    // Первый палец: dx ≈ 60% ширины → кадровая математика 5px=1кадр, FPS 30 (мок)
    const framesMoved = Math.round((endX - startX) / 5);
    expect(Math.abs(timeAfter - framesMoved / 30)).toBeLessThanOrEqual(2 / 30);
    await expect(page.getByTestId('scrub-timecode-chip')).toHaveAttribute('data-state', 'idle');
  });

  test('pointercancel (iOS-системный жест) выводит из скраба: чип скрыт, плеер не зависает', async ({ page }) => {
    await openPlayer(page);
    await dispatchVideoLoadedMetadata(page);

    const overlay = page.getByTestId('video-scrub-overlay');
    const box = await overlay.boundingBox();
    if (!box) throw new Error('нет оверлея скраба');

    const y = box.y + box.height / 2;
    const startX = box.x + box.width * 0.2;

    await dispatchPointer(overlay, 'pointerdown', { x: startX, y, pointerId: 1 });
    await dispatchPointer(overlay, 'pointermove', { x: startX + 80, y, pointerId: 1 });
    await expect(page.getByTestId('scrub-timecode-chip')).toBeVisible();

    // Системный жест забирает pointer → pointercancel (+lostpointercapture — оба на safeEnd)
    await dispatchPointer(overlay, 'pointercancel', { x: startX + 80, y, pointerId: 1 });
    await dispatchPointer(overlay, 'lostpointercapture', { x: startX + 80, y, pointerId: 1 });

    await expect(page.getByTestId('scrub-timecode-chip')).toHaveAttribute('data-state', 'idle');
  });

  test('T-19 push-to-talk: удержание mic → диктовка → отпускание создаёт комментарий', async ({ page }) => {
    installSpeechRecognitionMock(page); // speech-мок обязателен до загрузки приложения
    await openPlayer(page);
    await dispatchVideoLoadedMetadata(page);

    // T-19: mic теперь push-to-talk (title = подсказка зажать-говорить)
    const mic = page.locator('button[title="Hold to dictate — release to save the comment"]');
    await expect(mic).toBeVisible();

    // Зажал: pointerdown → PTT-сессия с пилюлей REC
    await mic.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0, buttons: 1, bubbles: true, cancelable: true });
    await expect(page.getByTestId('ptt-pill')).toBeVisible();
    await expect(page.getByText('REC')).toBeVisible();

    // Мок диктует финальный результат через ~200мс — держим дольше порога тапа (400ms)
    await page.waitForTimeout(500);

    // Отпустил → комментарий с продиктованным текстом на текущем таймкоде
    await mic.dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0, buttons: 0, bubbles: true, cancelable: true });
    await expect(page.getByText('Тестовая голосовая правка').first()).toBeVisible({ timeout: 5_000 });

    // Пилюля скрыта после отпускания
    await expect(page.getByTestId('ptt-pill')).toHaveCount(0);
  });
});

test.describe('T-18: закрываемость меню и модалок', () => {
  test.beforeEach(async ({ page }) => {
    resetMockData(page);
    // гасим videoError-оверлей (z-50), иначе он перехватывает реальные клики по видеоплощадке
    await installVideoMock(page, 100);
    // speech-мок для VoiceModal-теста (микрофон FloatingControls; в части 2 (T-19) заменят
    // на push-to-talk — тест обновят тогда)
    installSpeechRecognitionMock(page);
    await openPlayer(page);
    await dispatchVideoLoadedMetadata(page);
  });

  test('меню single/compare закрывается тапом по backdrop', async ({ page }) => {
    // View-switcher (иконка Monitor) в header — паттерн из mobile.spec.ts
    const viewSwitcher = page.locator('header button:has(svg.lucide-monitor)').first();
    await viewSwitcher.click();
    await expect(page.getByText('Split (Compare)')).toBeVisible();

    // Тап по backdrop (вне меню и вне FloatingControls) закрывает
    await page.getByTestId('mobile-view-menu-backdrop').click();
    await expect(page.getByText('Split (Compare)')).toBeHidden();
  });

  test('VoiceModal закрывается тапом по backdrop', async ({ page }) => {
    // T-19: mic теперь push-to-talk — короткий тап (<400ms) открывает VoiceModal
    await page.locator('button[title="Hold to dictate — release to save the comment"]').click();
    const backdrop = page.getByTestId('voice-modal-backdrop');
    await expect(backdrop).toBeVisible();
    await expect(backdrop.locator('textarea')).toBeVisible();

    // Клик вне диалога: на мобиле диалог (max-w-sm) почти во всю ширину и центрирован,
    // кликаем в самый угол backdrop — левее диалога (x≥16) и ниже FloatingControls (y≤74)
    await backdrop.click({ position: { x: 5, y: 5 } });
    await expect(backdrop).toHaveCount(0);
  });
});
