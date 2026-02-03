
import React from 'react';
import { AppHeader } from './AppHeader';
import { User } from '../types';
import { useLanguage } from '../services/i18n';

interface MainLayoutProps {
  children: React.ReactNode;
  currentUser: User | null;
  currentView: string;
  onNavigate: (page: string) => void;
  onBack: () => void;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children, currentUser, currentView, onNavigate, onBack }) => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col transition-colors duration-300">
      <AppHeader 
        currentUser={currentUser} 
        currentView={currentView} 
        onNavigate={onNavigate}
        onBack={onBack}
      />
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
         <div className="max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-col min-h-full">
            <div className="flex-1">
                {children}
            </div>
            
            <footer className="mt-12 py-6 border-t border-zinc-200 dark:border-zinc-800 text-center">
                <div className="text-xs text-zinc-500 dark:text-zinc-600 flex flex-col gap-1">
                    <span>&copy; {new Date().getFullYear()} Anotee. {t('footer.rights')}</span>
                    <span className="opacity-70">ИНН 910228340090</span>
                </div>
            </footer>
         </div>
      </div>
    </div>
  );
};
