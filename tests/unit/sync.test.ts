import { describe, it, expect } from 'vitest';
import { resolveSyncOutcome } from '../../api/_sync.js';

// T-05: 0 обновлённых строк = проигранная гонка → конфликт, а не ложный «updated»
describe('resolveSyncOutcome', () => {
  it('успешное обновление (rowCount=1) → updated с новой версией', () => {
    expect(resolveSyncOutcome(1, 7, { _version: 6 })).toEqual({ status: 'updated', _version: 7 });
  });

  it('гонка проиграна (rowCount=0) → conflict с серверной версией и документом', () => {
    const server = { _version: 12, name: 'From server' };
    const out = resolveSyncOutcome(0, 7, server) as any;
    expect(out.status).toBe('conflict');
    expect(out.serverVersion).toBe(12);
    expect(out.server).toEqual(server);
  });

  it('конфликт без серверных данных не выдумывает версию', () => {
    const out = resolveSyncOutcome(0, 7, null) as any;
    expect(out.status).toBe('conflict');
    expect(out.serverVersion).toBe(null);
    expect(out.server).toBe(null);
  });

  it('серверный документ без _version → serverVersion=null', () => {
    const out = resolveSyncOutcome(0, 7, { name: 'no version' }) as any;
    expect(out.status).toBe('conflict');
    expect(out.serverVersion).toBe(null);
  });

  it('несколько обновлённых строк тоже считается успехом', () => {
    expect((resolveSyncOutcome(3, 2, null) as any).status).toBe('updated');
  });
});
