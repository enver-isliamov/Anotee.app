#!/usr/bin/env node
/**
 * deploy-check — быстрая read-only проверка, что домен раздаёт свежую сборку.
 * Использование: node scripts/deploy-check.cjs [host ...]   (по умолчанию: dev.anotee.com anotee.com)
 */
const https = require('https');

const get = (host, path = '/') => new Promise((resolve) => {
  const req = https.request({ host, path, method: 'GET', headers: { 'Cache-Control': 'no-cache' }, timeout: 20000 }, (res) => {
    let d = '';
    res.on('data', (c) => { d += c; });
    res.on('end', () => resolve({ status: res.statusCode, body: d, location: res.headers.location }));
  });
  req.on('error', (e) => resolve({ status: 0, body: '', error: e.message }));
  req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: '', error: 'timeout' }); });
  req.end();
});

(async () => {
  const hosts = process.argv.slice(2).length ? process.argv.slice(2) : ['dev.anotee.com', 'anotee.com'];
  for (const host of hosts) {
    const root = await get(host);
    if (root.status >= 300 && root.status < 400 && root.location) {
      const loc = root.location.replace(/^https?:\/\/[^/]+/, '');
      const page = await get(host, loc);
      console.log(host + ': ' + root.status + ' -> ' + loc + ' | index=' + (((page.body || '').match(/index-([A-Za-z0-9_-]+)\.js/) || [])[1] || 'n/a'));
      continue;
    }
    const indexJs = ((root.body || '').match(/index-([A-Za-z0-9_-]+)\.js/) || [])[1] || 'n/a';
    const manifest = ((root.body || '').match(/manifest-([A-Za-z0-9]+)\.json/) || [])[1] || ((root.body || '').match(/rel="manifest" href="([^"]+)"/) || [])[1] || 'n/a';
    const health = await get(host, '/api/health');
    console.log(host + ': status=' + root.status + ' index=' + indexJs + ' manifest=' + manifest + ' health=' + health.status);
  }
})();
