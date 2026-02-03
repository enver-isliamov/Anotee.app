
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
            
            <footer className="mt-16 py-8 border-t border-zinc-200 dark:border-zinc-800">
                <div className="grid md:grid-cols-3 gap-8 text-center md:text-left">
                    {/* Brand */}
                    <div className="flex flex-col gap-2">
                        <div className="font-bold text-zinc-900 dark:text-white">Anotee</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-600">
                            &copy; {new Date().getFullYear()} {t('footer.rights')}
                        </div>
                    </div>

                    {/* Links */}
                    <div className="flex flex-col gap-2 text-xs">
                        <button onClick={() => onNavigate('TERMS')} className="text-zinc-600 dark:text-zinc-400 hover:text-indigo-500 transition-colors text-left text-center md:text-left">
                            {t('nav.terms')} (Публичная оферта)
                        </button>
                        <button onClick={() => onNavigate('PRIVACY')} className="text-zinc-600 dark:text-zinc-400 hover:text-indigo-500 transition-colors text-left text-center md:text-left">
                            {t('nav.privacy')} (Политика конфиденциальности)
                        </button>
                    </div>

                    {/* Contacts (Required by YooKassa) */}
                    <div className="text-xs text-zinc-500 dark:text-zinc-600 flex flex-col gap-1">
                        <div className="font-bold text-zinc-700 dark:text-zinc-400">Контакты и Реквизиты:</div>
                        <span>ИП/Самозанятый [ВАШЕ ФИО]</span>
                        <span>ИНН 910228340090</span>
                        <span>Email: [ВАШ EMAIL]</span>
                    </div>
                </div>
            </footer>
         </div>
      </div>
    </div>
  );
};
