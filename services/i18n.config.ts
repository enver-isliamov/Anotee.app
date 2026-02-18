
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Direct import of JSONs to avoid HTTP fetch issues in pure frontend
import en from './locales/en.json';
import ru from './locales/ru.json';
import es from './locales/es.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import pt from './locales/pt.json';

// Detect initial language
const getInitialLanguage = () => {
    // 1. LocalStorage
    const saved = localStorage.getItem('anotee_lang');
    if (saved && ['en', 'ru', 'es', 'ja', 'ko', 'pt'].includes(saved)) {
        return saved;
    }
    // 2. Browser
    const browserLang = navigator.language.split('-')[0];
    if (['ru', 'es', 'ja', 'ko', 'pt'].includes(browserLang)) {
        return browserLang;
    }
    return 'en';
};

i18n
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
    lng: getInitialLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
    react: {
        useSuspense: false // Avoid suspense for now
    }
  });

export default i18n;
