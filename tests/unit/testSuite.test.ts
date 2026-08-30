import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TEST_SUITE } from '../../services/testSuite';

/**
 * Контракт тест-сьюта (docs/TESTING.md §3): Diagnostics 2.0 не имеет права
 * падать «немо» — у каждого теста обязаны быть непустые
 * name/description/passCondition/failCondition.
 *
 * Сьют выполняется целиком (это чистые функции), но fetch заглушен,
 * чтобы unit-слой был детерминированным и не ходил в сеть.
 */
describe('TEST_SUITE контракт (System Diagnostics 2.0)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Offline (unit-test stub)');
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('id групп уникальны', () => {
    const ids = TEST_SUITE.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('у каждой группы непустые id/title/description и список тестов', () => {
    for (const group of TEST_SUITE) {
      expect(group.id.trim().length > 0, `группа: ${group.id}`).toBe(true);
      expect(group.title.trim().length > 0, `группа: ${group.id}`).toBe(true);
      expect(group.description.trim().length > 0, `группа: ${group.id}`).toBe(true);
      expect(typeof group.tests).toBe('function');
    }
  });

  it('каждый тест имеет непустые name/description/passCondition/failCondition', async () => {
    for (const group of TEST_SUITE) {
      const results = await group.tests();
      expect(results.length, `группа ${group.id} должна содержать тесты`).toBeGreaterThan(0);
      for (const result of results) {
        const fields: Array<[string, string | undefined]> = [
          ['name', result.name],
          ['description', result.description],
          ['passCondition', result.passCondition],
          ['failCondition', result.failCondition],
        ];
        for (const [field, value] of fields) {
          expect(
            typeof value === 'string' && value.trim().length > 0,
            `${group.id} → ${result.name || '<без имени>'}: ${field} обязателен и непуст`
          ).toBe(true);
        }
      }
    }
  });

  it('имена тестов уникальны в рамках группы', async () => {
    for (const group of TEST_SUITE) {
      const results = await group.tests();
      const names = results.map((r) => r.name);
      expect(new Set(names).size, `дубликаты имён в группе ${group.id}: ${names.join(', ')}`).toBe(names.length);
    }
  });
});
