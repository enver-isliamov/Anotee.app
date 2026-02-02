
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// 1. Pure Provider (No Clerk Dependency)
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    // 1. Try localStorage first for instant load
    const saved = localStorage.getItem('anotee_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    // 2. Default
    return 'dark'; 
  });

  // Apply to DOM
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('anotee_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// 2. Cloud Sync Component (Must be rendered inside ClerkProvider)
export const ThemeCloudSync: React.FC = () => {
    const { user, isSignedIn } = useUser();
    const { theme, setTheme } = useTheme();

    // Sync from Cloud (Clerk) on load
    useEffect(() => {
        if (isSignedIn && user) {
            const cloudTheme = user.unsafeMetadata?.settings as any;
            if (cloudTheme?.theme && (cloudTheme.theme === 'light' || cloudTheme.theme === 'dark')) {
                if (cloudTheme.theme !== theme) {
                    setTheme(cloudTheme.theme);
                }
            }
        }
    }, [isSignedIn, user, setTheme]); // Added setTheme to deps, loop safe if setState is stable

    // Sync to Cloud on change
    useEffect(() => {
        if (isSignedIn && user) {
            const updateCloud = async () => {
                const currentCloudTheme = (user.unsafeMetadata?.settings as any)?.theme;
                if (currentCloudTheme !== theme) {
                    try {
                        await user.update({
                            unsafeMetadata: {
                                ...user.unsafeMetadata,
                                settings: {
                                    ...(user.unsafeMetadata.settings as any),
                                    theme: theme
                                }
                            }
                        });
                    } catch (e) {
                        console.error("Failed to sync theme to cloud", e);
                    }
                }
            };
            // Debounce could be added here if rapid toggling is expected
            updateCloud();
        }
    }, [theme, isSignedIn, user]);

    return null; // Invisible component
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
