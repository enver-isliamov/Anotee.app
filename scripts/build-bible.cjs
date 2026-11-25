#!/usr/bin/env node
/**
 * Сборка «Библии проекта»: docs/bible/*.json → public/bible.html
 * Страница доступна по /bible.html и в админке (раздел «Библия»).
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'docs/bible');
const { buildHtml } = require('./bible/template.cjs');

function readJson(name) { return JSON.parse(fs.readFileSync(path.join(DATA, name), 'utf8')); }
function stampNow() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

function build() {
  const tasks = readJson('tasks.json');
  const chronicle = readJson('chronicle.json');
  const problems = readJson('problems.json');
  const roadmap = readJson('roadmap.json');
  const meta = stampNow();
  let html = buildHtml(JSON.stringify(tasks), JSON.stringify(chronicle), JSON.stringify(problems), JSON.stringify(roadmap), meta);
  html = html.split('__META_COUNT__').join(String(tasks.length));
  const out = path.join(ROOT, 'public/bible.html');
  fs.writeFileSync(out, html, 'utf8');
  console.log('bible: public/bible.html собран — задач ' + tasks.length + ', дорожная карта ' + roadmap.length + ' · ' + meta);
  return out;
}

if (require.main === module) build();
module.exports = { build };
