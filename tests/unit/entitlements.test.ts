import { describe, it, expect } from 'vitest';
import { isFeatureEnabled, getFeatureLimit } from '../../services/entitlements';
import { AppConfig, DEFAULT_CONFIG } from '../../types';

const configKeys = Object.keys(DEFAULT_CONFIG) as Array<keyof AppConfig>;

describe('isFeatureEnabled: матрица plan × feature (free vs pro, DEFAULT_CONFIG)', () => {
  it('значение для free всегда равно enabledForFree из конфига', () => {
    for (const key of configKeys) {
      expect(isFeatureEnabled(DEFAULT_CONFIG, key, 'free'), `key: ${key}`).toBe(DEFAULT_CONFIG[key].enabledForFree);
    }
  });

  it('значение для pro всегда равно enabledForPro из конфига', () => {
    for (const key of configKeys) {
      expect(isFeatureEnabled(DEFAULT_CONFIG, key, 'pro'), `key: ${key}`).toBe(DEFAULT_CONFIG[key].enabledForPro);
    }
  });

  it('базовые функции доступны на free', () => {
    expect(isFeatureEnabled(DEFAULT_CONFIG, 'max_projects', 'free')).toBe(true);
    expect(isFeatureEnabled(DEFAULT_CONFIG, 'ai_transcription', 'free')).toBe(true);
    expect(isFeatureEnabled(DEFAULT_CONFIG, 'version_comparison', 'free')).toBe(true);
  });

  it('монетизируемые функции закрыты на free и открыты на pro', () => {
    for (const key of ['export_xml', 'export_csv', 'google_drive', 'sharing_project', 'sharing_public_link', 'project_locking'] as Array<keyof AppConfig>) {
      expect(isFeatureEnabled(DEFAULT_CONFIG, key, 'free'), `key: ${key}`).toBe(false);
      expect(isFeatureEnabled(DEFAULT_CONFIG, key, 'pro'), `key: ${key}`).toBe(true);
    }
  });

  it('UI-флаги: баннер апселла виден только free', () => {
    expect(isFeatureEnabled(DEFAULT_CONFIG, 'ui_upsell_banner', 'free')).toBe(true);
    expect(isFeatureEnabled(DEFAULT_CONFIG, 'ui_upsell_banner', 'pro')).toBe(false);
  });

  it('отсутствующее правило → false для любого плана', () => {
    const emptyConfig = {} as AppConfig;
    expect(isFeatureEnabled(emptyConfig, 'export_xml', 'free')).toBe(false);
    expect(isFeatureEnabled(emptyConfig, 'export_xml', 'pro')).toBe(false);
  });
});

describe('getFeatureLimit: лимиты по плану', () => {
  it('max_projects: free=3, pro=1000, lifetime=10000', () => {
    expect(getFeatureLimit(DEFAULT_CONFIG, 'max_projects', 'free')).toBe(3);
    expect(getFeatureLimit(DEFAULT_CONFIG, 'max_projects', 'pro')).toBe(1000);
    expect(getFeatureLimit(DEFAULT_CONFIG, 'max_projects', 'lifetime')).toBe(10000);
  });

  it('отсутствующее правило → 0', () => {
    expect(getFeatureLimit({} as AppConfig, 'max_projects', 'pro')).toBe(0);
  });
});
