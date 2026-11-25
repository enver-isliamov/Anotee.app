import { describe, it, expect } from 'vitest';
import { formatTimecode, isExpired, getDaysRemaining, generateId, stringToColor } from '../../services/utils';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Декодирует HH:MM:SS:FF обратно в общее число кадров. */
const timecodeToFrames = (tc: string, fps: number): number => {
  const [hh, mm, ss, ff] = tc.split(':').map(Number);
  return hh * 3600 * fps + mm * 60 * fps + ss * fps + ff;
};

describe('formatTimecode (таймкоды в кадрах, железное правило №4)', () => {
  it('10.0s @ 24fps = 240 кадров → 00:00:10:00', () => {
    const tc = formatTimecode(10.0, 24);
    expect(tc).toBe('00:00:10:00');
    expect(timecodeToFrames(tc, 24)).toBe(Math.floor(10.0 * 24));
    expect(timecodeToFrames(tc, 24)).toBe(240);
  });

  it('формат HH:MM:SS:FF с нулевыми паддингами', () => {
    const tc = formatTimecode(65.5, 25);
    expect(tc).toMatch(/^\d{2}:\d{2}:\d{2}:\d{2}$/);
  });

  it('65.5s @ 25fps → 00:01:05:12 (эталон из testSuite)', () => {
    expect(formatTimecode(65.5, 25)).toBe('00:01:05:12');
  });

  it('дробные секунды округляются вниз до целого кадра (frames = floor(seconds * fps))', () => {
    // 0.5 * 24 = 12 кадров ровно
    expect(formatTimecode(0.5, 24)).toBe('00:00:00:12');
    // 0.04 * 24 = 0.96 → floor = 0 кадров
    expect(formatTimecode(0.04, 24)).toBe('00:00:00:00');
    // 1.5 * 25 = 37.5 → floor = 37 кадров
    expect(timecodeToFrames(formatTimecode(1.5, 25), 25)).toBe(37);
  });

  it('default fps = 30', () => {
    expect(formatTimecode(1)).toBe('00:00:01:00');
  });

  it('переносит часы/минуты без потери кадров', () => {
    expect(formatTimecode(3661.5, 24)).toBe('01:01:01:12');
  });
});

describe('isExpired (граничные даты)', () => {
  it('default порог — 7 дней', () => {
    expect(isExpired(Date.now() - 8 * DAY_MS)).toBe(true);
    expect(isExpired(Date.now() - 6 * DAY_MS)).toBe(false);
  });

  it('строгое неравенство: ровно на границе ещё не истекло', () => {
    // (now - ts) > days*ms — с запасом ±5с, чтобы тест не гонял за миллисекундами
    expect(isExpired(Date.now() - 7 * DAY_MS - 5_000)).toBe(true);
    expect(isExpired(Date.now() - 7 * DAY_MS + 5_000)).toBe(false);
  });

  it('кастомный порог дней', () => {
    expect(isExpired(Date.now() - 10 * DAY_MS, 10)).toBe(false);
    expect(isExpired(Date.now() - 11 * DAY_MS, 10)).toBe(true);
  });
});

describe('getDaysRemaining (граничные даты)', () => {
  it('свежий срок → полное число дней', () => {
    expect(getDaysRemaining(Date.now())).toBe(7);
    expect(getDaysRemaining(Date.now(), 30)).toBe(30);
  });

  it('истекший срок → 0 (не отрицательный)', () => {
    expect(getDaysRemaining(Date.now() - 10 * DAY_MS)).toBe(0);
  });

  it('округление вверх: 3.5 дня назад из 7 → 4 дня осталось', () => {
    expect(getDaysRemaining(Date.now() - 3.5 * DAY_MS)).toBe(4);
    expect(getDaysRemaining(Date.now() - 3.5 * DAY_MS, 10)).toBe(7);
  });
});

describe('generateId (уникальность)', () => {
  it('генерирует уникальные UUID-подобные id', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) ids.add(generateId());
    expect(ids.size).toBe(1000);
  });

  it('формат UUID v4', () => {
    expect(generateId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });
});

describe('stringToColor (детерминированность)', () => {
  it('одинаковый вход → одинаковый цвет', () => {
    expect(stringToColor('user_123')).toBe(stringToColor('user_123'));
  });

  it('разные входы → разные цвета (эталон из testSuite)', () => {
    expect(stringToColor('user_123')).not.toBe(stringToColor('user_456'));
  });

  it('возвращает детерминированный HSL-цвет', () => {
    expect(stringToColor('u1')).toMatch(/^hsl\(\d+, 70%, 60%\)$/);
  });
});
