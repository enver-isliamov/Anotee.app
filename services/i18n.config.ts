import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// T-11: базовые языки грузим сразу (en/ru), остальные — лениво, при выборе языка,
// чтобы не тащить ~90 KB переводов в главный чанк.
import en from './locales/en.json';
import ru from './locales/ru.json';

const LAZY_LOCALES: Record<string, () => Promise<{ default: Record<string, string> }>> = {
  es: () => import('./locales/es.json'),
  ja: () => import('./locales/ja.json'),
  ko: () => import('./locales/ko.json'),
  pt: () => import('./locales/pt.json'),
};

/** Догружает локаль по требованию (безопасно вызывать многократно). */
export async function ensureLocaleLoaded(lng: string): Promise<void> {
  const code = (lng || '').split('-')[0];
  const loader = LAZY_LOCALES[code];
  if (!loader) return;
  if (i18n.hasResourceBundle(code, 'translation')) return;
  try {
    const mod: any = await loader();
    i18n.addResourceBundle(code, 'translation', mod.default ?? mod, true, true);
  } catch (e) {
    console.error('[i18n] Не удалось загрузить локаль', code, e);
  }
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ru: { translation: ru },
    },
    fallbackLng: 'en',
    // Разрешаем добавлять языки после init (addResourceBundle)
    partialBundledLanguages: true,

    // CRITICAL for flat keys with dots (e.g. "nav.dashboard")
    keySeparator: false,
    nsSeparator: false,

    // Safety flags
    returnNull: false,
    returnEmptyString: false,

    interpolation: {
      escapeValue: false, // React handles XSS
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'anotee_lang',
      caches: ['localStorage'],
    },
  });

// Подгружаем выбранный язык при старте и при каждом переключении
void ensureLocaleLoaded(i18n.language || 'en');
i18n.on('languageChanged', (lng) => { void ensureLocaleLoaded(lng); });

export default i18n;
