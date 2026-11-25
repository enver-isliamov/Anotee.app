#!/usr/bin/env node
/**
 * Добавление задачи в Библию проекта.
 * Usage: node scripts/bible-add.cjs --name "Название" [--id T-400] [--area Хранилище]
 *        [--type fix] [--priority P1] [--status open] [--owner AutoCoder]
 *        [--model zai-auto] [--note "..."] [--hash abc1234]
 * После добавления: npm run bible:build
 */
const fs = require('fs');
const path = require('path');
const FILE = path.resolve(__dirname, '..', 'docs/bible/tasks.json');

function arg(name) {
  const i = process.argv.indexOf('--' + name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : '';
}
function stampNow() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

const name = arg('name');
if (!name) {
  console.error('Usage: node scripts/bible-add.cjs --name "..." [--id T-400] [--area ...] [--type fix] [--priority P1] [--status open] [--model zai-auto] [--note ...] [--hash abc1234]');
  process.exit(1);
}
const tasks = JSON.parse(fs.readFileSync(FILE, 'utf8'));
let id = arg('id');
if (!id) {
  const max = tasks.reduce((m, t) => (t.num && t.num > m ? t.num : m), 0);
  id = 'T-' + String(max + 1).padStart(2, '0');
}
const num = /^T-\d+$/.test(id) ? parseInt(id.slice(2), 10) : null;
const now = stampNow();
tasks.push({
  id, num, name,
  area: arg('area') || 'Прочее',
  t: arg('type') || 'chore',
  priority: arg('priority') || '',
  status: arg('status') || 'open',
  owner: arg('owner') || 'AutoCoder',
  model: arg('model') || 'zai-auto',
  updated: now,
  date: now.slice(0, 10),
  hash: arg('hash') || '',
  note: arg('note') || '',
});
tasks.sort((a, b) => (a.num == null ? 99999 : a.num) - (b.num == null ? 99999 : b.num));
fs.writeFileSync(FILE, JSON.stringify(tasks, null, 1), 'utf8');
console.log('bible-add: добавлено «' + name + '» (' + id + '), обновлено ' + now);
console.log('Не забудьте: npm run bible:build');
