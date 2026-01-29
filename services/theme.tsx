
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isSignedIn } = useUser();
  
  const [theme, setTheme] = useState<Theme>(() => {
    // 1. Try localStorage first for instant load
    const saved = localStorage.getItem('smotree_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    // 2. Default
    return 'dark'; 
  });

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
  }, [isSignedIn, user]);

  // Apply to DOM
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('smotree_theme', theme);
  }, [theme]);

  const toggleTheme = async () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    
    // Sync to Cloud
    if (isSignedIn && user) {
        try {
            await user.update({
                unsafeMetadata: {
                    ...user.unsafeMetadata,
                    settings: {
                        ...(user.unsafeMetadata.settings as any),
                        theme: newTheme
                    }
                }
            });
        } catch (e) {
            console.error("Failed to sync theme to cloud", e);
        }
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
