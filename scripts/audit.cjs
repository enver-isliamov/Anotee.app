// T-51: системный аудит Anotee.app
const fs = require('fs');
const path = require('path');
const out = { locales_missing: [], locales_unused: [], todo: [], empty_catch: [], console_log: [], ts_ignore: [], danger_html: [], alerts: [], hardcoded_ru: [], mock_refs: [] };
const ROOT = process.cwd();
const walk = (dir, exts, cb) => { for (const f of fs.readdirSync(dir)) { const fp = path.join(dir, f); const st = fs.statSync(fp); if (st.isDirectory()) { if (!/node_modules|dist|\.git|test-results/.test(fp)) walk(fp, exts, cb); } else if (exts.some(e => f.endsWith(e))) cb(fp); } };
// 1. локали
const ru = JSON.parse(fs.readFileSync('services/locales/ru.json', 'utf8'));
const en = JSON.parse(fs.readFileSync('services/locales/en.json', 'utf8'));
const used = new Set();
walk(ROOT + '/components', ['.tsx', '.ts'], fp => { const c = fs.readFileSync(fp, 'utf8'); const re = /\bt\('([a-zA-Z0-9_.]+)'/g; let m; while ((m = re.exec(c))) used.add(m[1]); });
walk(ROOT + '/services', ['.tsx', '.ts'], fp => { const c = fs.readFileSync(fp, 'utf8'); const re = /\bt\('([a-zA-Z0-9_.]+)'/g; let m; while ((m = re.exec(c))) used.add(m[1]); });
for (const k of used) { if (!(k in ru)) out.locales_missing.push(k + ' [ru]'); if (!(k in en)) out.locales_missing.push(k + ' [en]'); }
for (const k of Object.keys(ru)) { if (!used.has(k) && !k.startsWith('landing.') && !k.startsWith('legal.')) out.locales_unused.push(k); }
// 2..10: паттерны
const pats = [
  { re: /\/\/\s*(TODO|FIXME|HACK)[:\s]/gi, key: 'todo' },
  { re: /catch\s*(\([^)]*\))?\s*\{\s*\}/g, key: 'empty_catch' },
  { re: /console\.log\(/g, key: 'console_log' },
  { re: /@ts-ignore|@ts-expect-error/g, key: 'ts_ignore' },
  { re: /dangerouslySetInnerHTML/g, key: 'danger_html' },
  { re: /\b(alert|confirm)\(/g, key: 'alerts' },
  { re: /BigBuckBunny|MOCK_PROJECTS|clerkShim|isMockMode/g, key: 'mock_refs' },
];
const ruRe = /(title|placeholder|label|text)=\{?"[^"]*[\u0400-\u04FF][^"]*"/;
walk(ROOT + '/components', ['.tsx'], fp => {
  const rel = fp.replace(ROOT + path.sep, '').split(path.sep).join('/');
  const lines = fs.readFileSync(fp, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const p of pats) { if (p.re.test(line)) out[p.key].push(rel + ':' + (i + 1)); }
    if (ruRe.test(line)) out.hardcoded_ru.push(rel + ':' + (i + 1) + ' ' + line.trim().slice(0, 80));
  });
});
walk(ROOT + '/api', ['.js'], fp => {
  const rel = fp.replace(ROOT + path.sep, '').split(path.sep).join('/');
  const lines = fs.readFileSync(fp, 'utf8').split('\n');
  lines.forEach((line, i) => { for (const p of pats) { if (p.re.test(line)) out[p.key].push(rel + ':' + (i + 1)); } });
});
// сводка
const summary = {};
for (const k of Object.keys(out)) summary[k] = out[k].length;
fs.writeFileSync('audit-report.json', JSON.stringify({ summary, detail: out }, null, 2));
console.log(JSON.stringify(summary, null, 2));
