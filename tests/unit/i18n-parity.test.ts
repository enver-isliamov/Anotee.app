import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ru = JSON.parse(readFileSync('services/locales/ru.json', 'utf8'));
const en = JSON.parse(readFileSync('services/locales/en.json', 'utf8'));

const walk = (dir: string, acc: string[] = []): string[] => {
  for (const f of readdirSync(dir)) {
    const fp = join(dir, f);
    const st = statSync(fp);
    if (st.isDirectory()) { if (!/node_modules|dist|\.git/.test(fp)) walk(fp, acc); }
    else if (/\.tsx?$/.test(f)) acc.push(fp);
  }
  return acc;
};

describe('i18n parity (T-51)', () => {
  const files = [...walk('components'), ...walk('services')].filter(f => !f.includes('locales'));
  const used = new Set<string>();
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    const re = /\bt\('([a-zA-Z0-9_.]+)'/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) used.add(m[1]);
  }
  it('все ключи t() из кода существуют в ru.json', () => {
    const missing = [...used].filter(k => !(k in ru));
    expect(missing, 'отсутствуют в ru: ' + missing.join(', ')).toEqual([]);
  });
  it('все ключи t() из кода существуют в en.json', () => {
    const missing = [...used].filter(k => !(k in en));
    expect(missing, 'отсутствуют в en: ' + missing.join(', ')).toEqual([]);
  });
  it('ru и en содержат одинаковые наборы ключей', () => {
    const onlyRu = Object.keys(ru).filter(k => !(k in en));
    const onlyEn = Object.keys(en).filter(k => !(k in ru));
    expect(onlyRu, 'только в ru: ' + onlyRu.join(', ')).toEqual([]);
    expect(onlyEn, 'только в en: ' + onlyEn.join(', ')).toEqual([]);
  });
});
