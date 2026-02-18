import React, { createContext, useContext, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useTranslation } from 'react-i18next';
import './i18n.config'; // Import init side effects
import { LEGACY_DICTIONARIES } from './i18n.legacy';

export type Language = 'en' | 'ru' | 'es' | 'ja' | 'ko' | 'pt';

export const LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
];

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// 1. Pure Provider (No Clerk Dependency)
export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t: i18nT, i18n } = useTranslation();

  const changeLanguage = (lang: Language) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('anotee_lang', lang);
  };

  // Hybrid Translate Function with Legacy Fallback
  const t = (key: string): string => {
    // 1. Try i18next (checks loaded JSONs)
    if (i18n.exists(key)) {
      return i18nT(key);
    }

    // 2. Legacy Fallback (Safety Net)
    const currentLang = i18n.language as Language;
    const legacyValue = LEGACY_DICTIONARIES[currentLang]?.[key] || LEGACY_DICTIONARIES['en']?.[key];

    if (legacyValue) {
      if ((import.meta as any).env.DEV) {
        console.warn(`[i18n] Missing key in JSON "${key}", using legacy fallback.`);
      }
      return legacyValue;
    }

    // 3. Return key if nothing found
    return key;
  };

  return (
    <LanguageContext.Provider value={{ language: i18n.language as Language, setLanguage: changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

// 2. Cloud Sync Component (Render inside ClerkProvider)
export const LanguageCloudSync: React.FC = () => {
    const { user, isSignedIn } = useUser();
    const { language, setLanguage } = useLanguage();

    // Sync from Cloud
    useEffect(() => {
        if (isSignedIn && user) {
            const cloudLang = (user.unsafeMetadata?.settings as any)?.language;
            if (cloudLang && ['en', 'ru', 'es', 'ja', 'ko', 'pt'].includes(cloudLang)) {
                if (cloudLang !== language) {
                    setLanguage(cloudLang as Language);
                }
            }
        }
    }, [isSignedIn, user, setLanguage]);

    // Save to Cloud
    useEffect(() => {
        if (isSignedIn && user) {
            const updateCloud = async () => {
                const currentCloudLang = (user.unsafeMetadata?.settings as any)?.language;
                if (currentCloudLang !== language) {
                    try {
                        await user.update({
                            unsafeMetadata: {
                                ...user.unsafeMetadata,
                                settings: {
                                    ...(user.unsafeMetadata.settings as any),
                                    language: language
                                }
                            }
                        });
                    } catch(e) {
                        console.error("Cloud sync failed for lang", e);
                    }
                }
            };
            // Debounce slightly to avoid rapid updates
            const timer = setTimeout(updateCloud, 1000);
            return () => clearTimeout(timer);
        }
    }, [language, isSignedIn, user]);

    return null;
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};