/**
 * scripts/build-sw.cjs — T-158: генерация Service Worker после сборки.
 * Собирает precache-манифест из dist, считает версию кэша по содержимому и пишет dist/sw.js.
 * Без внешних зависимостей.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIST = path.join(process.cwd(), 'dist');
const CACHE_PREFIX = 'anotee';

const walk = (dir, base = '') => {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = base ? base + '/' + name : name;
    const st = fs.statSync(full);
    if (st.isDirectory()) out.push(...walk(full, rel));
    else out.push(rel);
  }
  return out;
};

if (!fs.existsSync(DIST)) {
  console.error('build-sw: dist/ не найден — сначала выполните сборку');
  process.exit(1);
}

// 1) манифест: только то, что реально нужно для старта приложения офлайн
const all = walk(DIST);
const isPrecache = (rel) =>
  !rel.endsWith('.map') &&          // sourcemaps в офлайне не нужны
  !rel.endsWith('.wasm') &&         // wasm для транскрибации грузится по требованию
  (rel === 'index.html' ||
    rel === 'manifest.json' ||
    rel === 'logo.svg' ||
    rel === 'logo.png' ||
    rel.startsWith('assets/') ||
    rel.startsWith('img/') ||
    rel === 'offline.html');
const precache = all.filter(isPrecache).map((rel) => '/' + rel);

// 2) версия кэша — по содержимому манифеста (хешированные имена дают инвалидацию автоматически)
const h = crypto.createHash('sha256');
for (const rel of precache.slice().sort()) {
  if (rel === '/index.html') continue; // index не хеширован, его содержимое меняется часто — учитываем ниже
  const p = path.join(DIST, rel.replace(/^\//, ''));
  if (fs.existsSync(p)) h.update(rel + ':' + fs.statSync(p).size);
}
const indexHtml = fs.existsSync(path.join(DIST, 'index.html')) ? fs.readFileSync(path.join(DIST, 'index.html'), 'utf8') : '';
h.update('index:' + indexHtml);
const version = h.digest('hex').slice(0, 10);
const cacheName = CACHE_PREFIX + '-v' + version;

const swSource = `/* Anotee Service Worker — автосгенерирован scripts/build-sw.cjs. НЕ редактировать вручную. */
const CACHE = '${cacheName}';
const CACHE_PREFIX = '${CACHE_PREFIX}-';
const PRECACHE = ${JSON.stringify(precache, null, 2)};
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Кэшируем по одному: сбой одного файла не должен ломать установку SW.
    await Promise.all(PRECACHE.map(async (url) => {
      try { await cache.add(new Request(url, { cache: 'reload' })); }
      catch (e) { /* пропускаем недоступный ресурс */ }
    }));
    try { await cache.add(new Request(OFFLINE_URL, { cache: 'reload' })); } catch (e) { /* ignore */ }
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Удаляем кэши предыдущих версий — никаких «залипших» сборок.
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith(CACHE_PREFIX) && n !== CACHE).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

const isStaticAsset = (url) =>
  url.pathname.startsWith('/assets/') ||
  /\\.(?:js|css|html|woff2?|ttf|otf|svg|png|jpe?g|gif|webp|ico|mp4|webm)$/i.test(url.pathname);

const isApi = (url) => url.pathname.startsWith('/api/');

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;                 // POST/прочее — только сеть
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;  // внешние домены — passthrough

  // 1) API — только сеть; офлайн → осмысленный JSON 503 (данные не кэшируем)
  if (isApi(url)) {
    event.respondWith((async () => {
      try { return await fetch(req); }
      catch (e) {
        return new Response(JSON.stringify({ error: 'Офлайн: сервер недоступен. Повторите, когда появится сеть.' }), {
          status: 503, headers: { 'Content-Type': 'application/json; charset=utf-8' }
        });
      }
    })());
    return;
  }

  // 2) Навигация (HTML) — network-first, офлайн → кэшированный index.html, затем offline.html
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put('/index.html', fresh.clone()).catch(() => {});
        return fresh;
      } catch (e) {
        const cache = await caches.open(CACHE);
        const cached = (await cache.match('/index.html')) || (await cache.match(OFFLINE_URL));
        return cached || new Response('Офлайн', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
    })());
    return;
  }

  // 3) Статика — cache-first (хешированные имена = immutable), при промахе — сеть и добор в кэш
  if (isStaticAsset(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) cache.put(req, fresh.clone()).catch(() => {});
        return fresh;
      } catch (e) {
        return hit || new Response('', { status: 504 });
      }
    })());
    return;
  }
});
`;

fs.writeFileSync(path.join(DIST, 'sw.js'), swSource, 'utf8');

// 3) офлайн-страница (заглушка) — на русском, стиль приложения, без внешних ресурсов
const offlineHtml = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<title>Нет сети — Anotee</title>
<style>
  :root { color-scheme: dark light; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100dvh; display: flex; align-items: center; justify-content: center;
         background: #09090b; color: #e4e4e7; font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; padding: 24px; }
  .card { max-width: 420px; width: 100%; background: #18181b; border: 1px solid #27272a; border-radius: 20px;
          padding: 28px; text-align: center; box-shadow: 0 18px 40px rgba(0,0,0,.45); }
  .icon { width: 56px; height: 56px; margin: 0 auto 16px; border-radius: 18px; background: rgba(99,102,241,.12);
          display: flex; align-items: center; justify-content: center; color: #818cf8; font-size: 26px; }
  h1 { font-size: 18px; margin: 0 0 8px; }
  p { color: #a1a1aa; font-size: 13px; line-height: 1.55; margin: 0 0 18px; }
  button { width: 100%; padding: 12px 16px; border-radius: 14px; border: 0; background: #4f46e5; color: #fff;
           font-size: 14px; font-weight: 700; cursor: pointer; }
  button:active { transform: translateY(1px); }
  .hint { margin-top: 14px; font-size: 11px; color: #71717a; }
</style>
</head>
<body>
  <div class="card">
    <div class="icon">⚡</div>
    <h1>Нет сети</h1>
    <p>Anotee работает офлайн для уже открытых страниц. Этот раздел ещё не загружался, поэтому нужен интернет.<br />Проверьте соединение — и повторите.</p>
    <button onclick="location.reload()">Повторить</button>
    <div class="hint">Загруженные проекты и транскрипты остаются доступны.</div>
  </div>
</body>
</html>
`;
fs.writeFileSync(path.join(DIST, 'offline.html'), offlineHtml, 'utf8');

console.log('build-sw: sw.js создан, версия кэша ' + cacheName + ', precache ' + (precache.length + 1) + ' файлов');
console.log('build-sw: precache → ' + precache.slice(0, 8).join(', ') + (precache.length > 8 ? ' …' : ''));
