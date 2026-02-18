import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import local JSON files
import en from './locales/en.json';
import ru from './locales/ru.json';
import es from './locales/es.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import pt from './locales/pt.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ru: { translation: ru },
      es: { translation: es },
      ja: { translation: ja },
      ko: { translation: ko },
      pt: { translation: pt },
    },
    fallbackLng: 'en',
    
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

export default i18n;