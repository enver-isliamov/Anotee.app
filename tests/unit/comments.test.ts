import { describe, it, expect } from 'vitest';
import { applyCommentAction } from '../../api/_comments.js';

// T-13: повторный create (retry при 409 / гонка с полным sync) не должен создавать дубликаты
describe('applyCommentAction (идемпотентность)', () => {
  it('create добавляет комментарий', () => {
    const c: any[] = [];
    const r = applyCommentAction(c, 'create', { id: 'c1', text: 'hi' }, 'u1');
    expect(r.status).toBe('created');
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ id: 'c1', text: 'hi', userId: 'u1' });
  });

  it('повторный create с тем же id не создаёт дубликат', () => {
    const c: any[] = [];
    applyCommentAction(c, 'create', { id: 'c1', text: 'hi' }, 'u1');
    const r2 = applyCommentAction(c, 'create', { id: 'c1', text: 'hi' }, 'u1');
    expect(r2.status).toBe('exists');
    expect(c).toHaveLength(1);
  });

  it('create двух разных комментариев — оба на месте', () => {
    const c: any[] = [];
    applyCommentAction(c, 'create', { id: 'c1' }, 'u1');
    applyCommentAction(c, 'create', { id: 'c2' }, 'u1');
    expect(c).toHaveLength(2);
  });

  it('update обновляет существующий; отсутствующий — missing без изменений', () => {
    const c: any[] = [{ id: 'c1', text: 'old', userId: 'u1' }];
    expect(applyCommentAction(c, 'update', { id: 'c1', text: 'new' }, 'u1').status).toBe('updated');
    expect(c[0].text).toBe('new');
    expect(applyCommentAction(c, 'update', { id: 'x', text: 'n' }, 'u1').status).toBe('missing');
    expect(c).toHaveLength(1);
  });

  it('delete удаляет; повторный delete — missing (идемпотентно)', () => {
    const c: any[] = [{ id: 'c1', userId: 'u1' }];
    expect(applyCommentAction(c, 'delete', { id: 'c1' }, 'u1').status).toBe('deleted');
    expect(c).toHaveLength(0);
    expect(applyCommentAction(c, 'delete', { id: 'c1' }, 'u1').status).toBe('missing');
  });

  it('неизвестное действие / пустой payload — noop', () => {
    const c: any[] = [];
    expect(applyCommentAction(c, 'bogus' as any, { id: 'c1' }, 'u1').status).toBe('noop');
    expect(applyCommentAction(c, 'create', null as any, 'u1').status).toBe('noop');
  });
});
