
import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// 1. Pure Provider (Always Dark)
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Always dark
  const theme: Theme = 'dark';

  // Apply to DOM
  useEffect(() => {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
  }, []);

  const toggleTheme = () => {
    // No-op
    console.log("Light mode is disabled.");
  };

  const setTheme = (t: any) => {
      // No-op
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// 2. Cloud Sync Component (Stub)
export const ThemeCloudSync: React.FC = () => {
    return null; 
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
