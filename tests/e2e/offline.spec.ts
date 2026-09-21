import { test, expect } from '@playwright/test';

/**
 * T-158: офлайн-режим (Service Worker) — проверяется на прод-сборке через `vite preview`.
 * Сервер поднимает отдельный конфиг: playwright.offline.config.ts (webServer).
 */
const BASE = process.env.OFFLINE_BASE || 'http://localhost:4174';

test('офлайн: SW регистрируется, приложение открывается без сети, заглушка работает', async ({ browser }) => {
  test.setTimeout(180_000);
  const context = await browser.newContext();
  const page = await context.newPage();

  // 1) первый онлайн-визит → SW устанавливается
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const swState = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return 'unsupported';
    const reg = await navigator.serviceWorker.ready;
    return reg.active ? 'active' : 'installing';
  });
  expect(swState, 'Service Worker не активировался').toBe('active');

  const swFile = await page.evaluate(async () => (await fetch('/sw.js')).status);
  expect(swFile, '/sw.js недоступен').toBe(200);

  const cachesList = await page.evaluate(async () => (await caches.keys()).filter((k) => k.startsWith('anotee-')));
  expect(cachesList.length, 'кэш SW не создан').toBeGreaterThan(0);
  console.log('OFFLINE-CHECK caches=' + cachesList.join(',') + ' sw=' + swState);

  // 2) офлайн → перезагрузка должна открыть приложение (не системную ошибку)
  await context.setOffline(true);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1500);
  const bodyText = await page.evaluate(() => document.body.innerText || '');
  expect(bodyText.length, 'офлайн-страница пуста').toBeGreaterThan(5);
  const isBrowserError = /ERR_INTERNET_DISCONNECTED|ERR_FAILED|No internet/i.test(bodyText);
  expect(isBrowserError, 'показана системная ошибка браузера вместо приложения').toBe(false);

  // 3) офлайн-заглушка: SW отдаёт её из кэша (не системная ошибка)
  const offlineHtml = await page.evaluate(async () => {
    try {
      const r = await fetch('/offline.html');
      return r.ok ? await r.text() : 'HTTP ' + r.status;
    } catch (e: any) { return 'ERR ' + (e?.message || e); }
  });
  expect(/Нет сети/i.test(offlineHtml), 'офлайн-заглушка недоступна из кэша: ' + String(offlineHtml).slice(0, 80)).toBe(true);

  // 4) API в офлайне → понятный JSON 503 (без системных ошибок)
  const apiOffline = await page.evaluate(async () => {
    try {
      const r = await fetch('/api/health');
      return { status: r.status, body: (await r.text()).slice(0, 120) };
    } catch (e: any) { return { status: -1, body: String(e?.message || e) }; }
  });
  console.log('OFFLINE-API ' + JSON.stringify(apiOffline));
  expect(apiOffline.status, 'API в офлайне должен отвечать 503 JSON').toBe(503);

  await context.setOffline(false);
  await context.close();
});
