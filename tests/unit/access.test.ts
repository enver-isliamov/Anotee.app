import { describe, it, expect } from 'vitest';
import { isKeyInProject, areKeysInProject, canManageProject, touchesStructuralFields, stripStructuralChanges } from '../../api/_access.js';

// T-04: ключи S3 привязаны к папке проекта
describe('isKeyInProject', () => {
  it('ключ внутри папки проекта — ок', () => {
    expect(isKeyInProject('anotee/p1/file.mp4', 'p1')).toBe(true);
    expect(isKeyInProject('anotee/p1/sub/dir/file.mov', 'p1')).toBe(true);
  });

  it('сама папка проекта (для delete_folder) — ок', () => {
    expect(isKeyInProject('anotee/p1', 'p1')).toBe(true);
  });

  it('чужой проект — отказ', () => {
    expect(isKeyInProject('anotee/p2/file.mp4', 'p1')).toBe(false);
  });

  it('похожий префикс не проходит (p1x ≠ p1)', () => {
    expect(isKeyInProject('anotee/p1x/file.mp4', 'p1')).toBe(false);
    expect(isKeyInProject('anotee/p1-other/file.mp4', 'p1')).toBe(false);
  });

  it('произвольные ключи и мусор — отказ', () => {
    expect(isKeyInProject('file.mp4', 'p1')).toBe(false);
    expect(isKeyInProject('', 'p1')).toBe(false);
    expect(isKeyInProject(null, 'p1')).toBe(false);
    expect(isKeyInProject('anotee/p1/file.mp4', '')).toBe(false);
  });
});

describe('areKeysInProject', () => {
  it('все ключи свои — ок', () => {
    expect(areKeysInProject(['anotee/p1/a', 'anotee/p1/b'], 'p1')).toBe(true);
  });
  it('один чужой ключ — отказ', () => {
    expect(areKeysInProject(['anotee/p1/a', 'anotee/p2/b'], 'p1')).toBe(false);
  });
  it('пустой список — отказ', () => {
    expect(areKeysInProject([], 'p1')).toBe(false);
    expect(areKeysInProject(null, 'p1')).toBe(false);
  });
});

// T-06: настройки проекта меняет только владелец/менеджер
describe('canManageProject', () => {
  const ownerRow = { owner_id: 'u1', data: { team: [] } };
  const teamRow = (role: string) => ({ owner_id: 'other', data: { team: [{ id: 'u1', role }] } });

  it('владелец — да (по id/userId/email)', () => {
    expect(canManageProject({ id: 'u1' }, ownerRow)).toBe(true);
    expect(canManageProject({ userId: 'u1' }, ownerRow)).toBe(true);
    expect(canManageProject({ email: 'u1' }, ownerRow)).toBe(true);
  });

  it('менеджер/админ — да', () => {
    expect(canManageProject({ id: 'u1' }, teamRow('manager'))).toBe(true);
    expect(canManageProject({ id: 'u1' }, teamRow('admin'))).toBe(true);
    expect(canManageProject({ id: 'u1' }, teamRow('OWNER'))).toBe(true);
  });

  it('viewer и member — нет', () => {
    expect(canManageProject({ id: 'u1' }, teamRow('viewer'))).toBe(false);
    expect(canManageProject({ id: 'u1' }, teamRow('member'))).toBe(false);
    expect(canManageProject({ id: 'u1' }, { owner_id: 'other', data: { team: [] } })).toBe(false);
  });
});

describe('touchesStructuralFields / stripStructuralChanges', () => {
  it('структурное изменение распознаётся', () => {
    expect(touchesStructuralFields({ name: 'new' })).toBe(true);
    expect(touchesStructuralFields({ team: [] })).toBe(true);
    expect(touchesStructuralFields({ publicAccess: 'view' })).toBe(true);
    expect(touchesStructuralFields({ isLocked: true })).toBe(true);
  });

  it('данные ревью не считаются структурными', () => {
    expect(touchesStructuralFields({ comments: [], transcript: [] })).toBe(false);
    expect(touchesStructuralFields({})).toBe(false);
    expect(touchesStructuralFields(null)).toBe(false);
  });

  it('для участника структурные поля берутся с сервера', () => {
    const existing = { name: 'Real name', team: [{ id: 'owner' }], publicAccess: 'private', comments: [1] };
    const incoming = { name: 'Hacked', team: [], publicAccess: 'public', comments: [1, 2] };
    const safe = stripStructuralChanges(incoming, existing);
    expect(safe.name).toBe('Real name');
    expect(safe.team).toEqual([{ id: 'owner' }]);
    expect(safe.publicAccess).toBe('private');
    expect(safe.comments).toEqual([1, 2]);
  });
});
