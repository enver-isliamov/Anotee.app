#!/usr/bin/env node
// Сканирует собранные артефакты (dist/index.html + dist/assets/*.css) на хосты,
// заблокированные/нестабильные в РФ. Запускается после `npm run build` (см. CI и
// docs/RF-RESILIENCE.md). Если найдено хотя бы одно вхождение — печатает список и
// завершается с кодом 1.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const BANNED_HOSTS = [
  'cdn.tailwindcss.com',     // CDN-сборка Tailwind (заменена локальной, T-15)
  'esm.sh',                  // runtime-модули importmap (заменены Vite-бандлом, T-15)
  'cdn-lfs.huggingface.co',  // LFS-файлы моделей Whisper (заменяемые зеркалом, T-16)
];

const distDir = join(process.cwd(), 'dist');
if (!existsSync(distDir)) {
  console.error('[check:external] dist/ не найден — сначала выполните npm run build');
  process.exit(1);
}

// dist/index.html + все *.css в dist/assets
const targets = [];
const indexPath = join(distDir, 'index.html');
if (existsSync(indexPath)) targets.push(indexPath);
const assetsDir = join(distDir, 'assets');
if (existsSync(assetsDir)) {
  for (const name of readdirSync(assetsDir)) {
    if (name.endsWith('.css')) targets.push(join(assetsDir, name));
  }
}

const findings = [];
for (const file of targets) {
  const content = readFileSync(file, 'utf8');
  for (const host of BANNED_HOSTS) {
    if (content.includes(host)) findings.push({ file, host });
  }
}

if (findings.length > 0) {
  console.error('[check:external] НАЙДЕНЫ запрещённые внешние хосты в собранных артефактах:');
  for (const { file, host } of findings) {
    console.error(`  ${host}  →  ${file}`);
  }
  process.exit(1);
}

console.log(`[check:external] OK: ${targets.length} файл(ов) проверено, запрещённых хостов нет (${BANNED_HOSTS.join(', ')})`);
