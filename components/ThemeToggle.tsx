
import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../services/theme';

export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white transition-colors"
      title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
};
