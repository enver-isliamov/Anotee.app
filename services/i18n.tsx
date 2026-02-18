import React, { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useTranslation } from 'react-i18next';
import './i18n.config';

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
  const { t: originalT, i18n } = useTranslation();

  const changeLanguage = useCallback((lang: Language) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('anotee_lang', lang);
  }, [i18n]);

  // Safe wrapper to prevent raw keys from appearing in UI
  const t = (key: string): string => {
      const result = originalT(key);
      
      // If result is the key itself (missing translation)
      if (result === key) {
          // 1. Log warning in dev
          // Cast import.meta to any to avoid TS error if types are missing
          if ((import.meta as any).env?.DEV) {
              console.warn(`[i18n] Missing key: "${key}" in language: ${i18n.language}`);
          }
          
          // 2. Try English fallback explicitly if current lang is not English
          if (i18n.language !== 'en') {
              const enResult = i18n.getFixedT('en')(key);
              // If English has it, return English text instead of raw key
              if (enResult !== key) {
                  return enResult;
              }
          }
      }
      return result;
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
    const hasHydratedFromCloud = useRef(false);

    // Sync from Cloud ONLY once on initial auth load to avoid overriding manual selection.
    useEffect(() => {
        if (!isSignedIn || !user || hasHydratedFromCloud.current) return;

        const cloudLang = (user.unsafeMetadata?.settings as any)?.language;
        if (cloudLang && ['en', 'ru', 'es', 'ja', 'ko', 'pt'].includes(cloudLang)) {
            if (cloudLang !== language) {
                setLanguage(cloudLang as Language);
            }
        }

        hasHydratedFromCloud.current = true;
    }, [isSignedIn, user, language, setLanguage]);

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
