
import React from 'react';
import { AppHeader } from './AppHeader';
import { LayoutGrid, CreditCard, Settings, Sparkles } from 'lucide-react';
import { User } from '../types';
import { useLanguage } from '../services/i18n';

interface MainLayoutProps {
  children: React.ReactNode;
  currentUser: User | null;
  currentView: string;
  onNavigate: (page: string) => void;
  onBack: () => void;
  onStartTour?: () => void; // Added prop
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children, currentUser, currentView, onNavigate, onBack, onStartTour }) => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      <AppHeader 
        currentUser={currentUser} 
        currentView={currentView} 
        onNavigate={onNavigate}
        onBack={onBack}
        onStartTour={onStartTour}
      />
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
         <div className="max-w-[1600px] mx-auto pb-16 md:pb-0 animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-col min-h-full">
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
                        <a 
                            href="/terms"
                            onClick={(e) => { e.preventDefault(); onNavigate('TERMS'); }} 
                            className="text-zinc-600 dark:text-zinc-400 hover:text-indigo-500 transition-colors text-left text-center md:text-left"
                        >
                            {t('nav.terms')} (Публичная оферта)
                        </a>
                        <a 
                            href="/privacy"
                            onClick={(e) => { e.preventDefault(); onNavigate('PRIVACY'); }} 
                            className="text-zinc-600 dark:text-zinc-400 hover:text-indigo-500 transition-colors text-left text-center md:text-left"
                        >
                            {t('nav.privacy')} (Политика конфиденциальности)
                        </a>
                    </div>

                    {/* Contacts (Required by YooKassa) */}
                    <div className="text-xs text-zinc-500 dark:text-zinc-600 flex flex-col gap-1">
                        <div className="font-bold text-zinc-700 dark:text-zinc-400">Контакты и Реквизиты:</div>
                        <span>ИП/Самозанятый [ИСЛЯМОВ ЭНВЕР ЯКУБОВИЧ]</span>
                        <span>ИНН 910228340090</span>
                        <span>Email: [enver.isliamov@yandex.com]</span>
                    </div>
                </div>
            </footer>
         </div>
            {/* T-116: нижняя навигация (мобильные/PWA) — шапка разгружена */}
            <nav data-testid="bottom-nav" className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur border-t border-zinc-200 dark:border-zinc-800 flex items-stretch justify-around safe-bottom">
                {[
                    { id: 'DASHBOARD', label: t('nav.projects') || 'Проекты', icon: LayoutGrid },
                    { id: 'PRICING', label: t('nav.pricing') || 'Тарифы', icon: CreditCard },
                    { id: 'PROFILE', label: t('nav.settings') || 'Настройки', icon: Settings },
                    { id: 'AI_FEATURES', label: t('nav.features') || 'Возможности', icon: Sparkles }
                ].map((item) => {
                    const ItemIcon = item.icon as any;
                    const active = currentView === item.id;
                    return (
                        <button key={item.id} onClick={() => onNavigate(item.id)} data-testid={'bottom-nav-' + item.id.toLowerCase()} className={'flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-bold transition-colors ' + (active ? 'text-indigo-500' : 'text-zinc-500 hover:text-zinc-300')}>
                            <ItemIcon size={18} />
                            {item.label}
                        </button>
                    );
                })}
            </nav>
      </div>
    </div>
  );
};
