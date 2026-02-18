
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import i18n from './i18n.config'; // Import the initialized instance

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

// 1. Pure Provider (Adapter for i18next)
export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Sync state with i18next to trigger re-renders when language changes
  const [language, setLanguageState] = useState<Language>(i18n.language as Language);

  useEffect(() => {
      const handleLangChange = (lang: string) => {
          setLanguageState(lang as Language);
          localStorage.setItem('anotee_lang', lang);
      };
      
      i18n.on('languageChanged', handleLangChange);
      return () => {
          i18n.off('languageChanged', handleLangChange);
      };
  }, []);

  const setLanguage = (lang: Language) => {
      i18n.changeLanguage(lang);
  };

  const t = (key: string) => i18n.t(key);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
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
            const cloudLang = user.unsafeMetadata?.settings as any;
            if (cloudLang?.language && ['en', 'ru', 'es', 'ja', 'ko', 'pt'].includes(cloudLang.language)) {
                if (cloudLang.language !== language) {
                    setLanguage(cloudLang.language as Language);
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
            updateCloud();
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
