/**
 * services/swRegister.ts — регистрация Service Worker (только production).
 * T-158: офлайн-режим.
 */

export type SwEvents = {
  onUpdateAvailable?: (apply: () => void) => void;
  onOffline?: () => void;
  onOnline?: () => void;
};

export const registerServiceWorker = (events: SwEvents = {}): void => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  // В dev не регистрируем: SW мешает Vite HMR и подменяет модули.
  if (import.meta.env.DEV) return;

  window.addEventListener('offline', () => events.onOffline?.());
  window.addEventListener('online', () => events.onOnline?.());

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        // Новая версия уже ждёт активации
        if (registration.waiting) {
          events.onUpdateAvailable?.(() => {
            registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
            window.location.reload();
          });
        }
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              events.onUpdateAvailable?.(() => {
                installing.postMessage({ type: 'SKIP_WAITING' });
                window.location.reload();
              });
            }
          });
        });
        // Раз в полчаса проверяем обновления (без «залипания» старой сборки)
        setInterval(() => { registration.update().catch(() => {}); }, 30 * 60 * 1000);
      })
      .catch((e) => console.warn('SW registration failed:', e && e.message ? e.message : e));
  });
};

export const isOffline = (): boolean => typeof navigator !== 'undefined' && navigator.onLine === false;
