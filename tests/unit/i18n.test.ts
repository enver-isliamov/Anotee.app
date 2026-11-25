import { describe, it, expect } from 'vitest';
import en from '../../services/locales/en.json';
import ru from '../../services/locales/ru.json';
import es from '../../services/locales/es.json';
import ja from '../../services/locales/ja.json';
import ko from '../../services/locales/ko.json';
import pt from '../../services/locales/pt.json';

/**
 * Контракт i18n (docs/TESTING.md §1):
 * - en.json и ru.json — идентичный набор ключей (полный русский перевод);
 * - es/ja/ko/pt — частичные, но не содержат ключей, отсутствующих в en (иначе fallback сломан).
 * Файлы локалей — плоский JSON: ключи вида "a.b.c".
 */
const PARTIAL_LOCALES: Array<[string, Record<string, string>]> = [
  ['es', es as Record<string, string>],
  ['ja', ja as Record<string, string>],
  ['ko', ko as Record<string, string>],
  ['pt', pt as Record<string, string>],
];

describe('i18n контракт', () => {
  it('en.json не пуст', () => {
    expect(Object.keys(en).length).toBeGreaterThan(200);
  });

  it('ru.json содержит ровно тот же набор ключей, что и en.json', () => {
    const enKeys = new Set(Object.keys(en));
    const ruKeys = new Set(Object.keys(ru));

    const missingInRu = [...enKeys].filter((k) => !ruKeys.has(k));
    const extraInRu = [...ruKeys].filter((k) => !enKeys.has(k));

    expect(missingInRu, 'ключи en, отсутствующие в ru').toEqual([]);
    expect(extraInRu, 'ключи ru, которых нет в en (мёртвые — удалить)').toEqual([]);
  });

  it('ru-значения — непустые строки', () => {
    for (const [key, value] of Object.entries(ru as Record<string, string>)) {
      expect(typeof value === 'string' && value.trim().length > 0, `ключ: ${key}`).toBe(true);
    }
  });

  it.each(PARTIAL_LOCALES)('%s.json не содержит ключей, отсутствующих в en.json', (_name, locale) => {
    const enKeys = new Set(Object.keys(en));
    const unknown = Object.keys(locale).filter((k) => !enKeys.has(k));
    expect(unknown, 'ключи, которых нет в en (не попадут в fallback)').toEqual([]);
  });
});
