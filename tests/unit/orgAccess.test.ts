import { describe, it, expect } from 'vitest';
import { isOrgMember, extractOrgIds } from '../../api/_orgAccess.js';

// T-02: ORG LIST не должен отдавать проекты чужой организации
describe('isOrgMember', () => {
  it('пользователь — член запрошенной организации', () => {
    expect(isOrgMember(['org_1', 'org_2'], 'org_2')).toBe(true);
  });

  it('чужая организация отклоняется', () => {
    expect(isOrgMember(['org_1'], 'org_evil')).toBe(false);
  });

  it('пустой список организаций — отказ (fail-closed)', () => {
    expect(isOrgMember([], 'org_1')).toBe(false);
    expect(isOrgMember(null, 'org_1')).toBe(false);
    expect(isOrgMember(undefined, 'org_1')).toBe(false);
  });

  it('пустой/некорректный targetOrgId — отказ', () => {
    expect(isOrgMember(['org_1'], '')).toBe(false);
    expect(isOrgMember(['org_1'], null)).toBe(false);
    expect(isOrgMember(['org_1'], 42)).toBe(false);
  });

  it('точное совпадение, без «похожих» id', () => {
    expect(isOrgMember(['org_10'], 'org_1')).toBe(false);
    expect(isOrgMember(['org_1'], 'org_1 ')).toBe(false);
  });
});

describe('extractOrgIds', () => {
  it('вытаскивает id из ответа Clerk', () => {
    expect(extractOrgIds({ data: [{ organization: { id: 'org_1' } }, { organization: { id: 'org_2' } }] })).toEqual(['org_1', 'org_2']);
  });

  it('устойчиво к пустым/битым записям', () => {
    expect(extractOrgIds({ data: [null, {}, { organization: null }] })).toEqual([]);
    expect(extractOrgIds(undefined)).toEqual([]);
    expect(extractOrgIds({ data: 'nope' })).toEqual([]);
  });
});
