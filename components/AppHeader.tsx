
import React, { useState } from 'react';
import { Menu, X, PlayCircle, Shield } from 'lucide-react';
import { useLanguage } from '../services/i18n';
import { LanguageSelector } from './LanguageSelector';
import { ThemeToggle } from './ThemeToggle';
import { User } from '../types';
import { OrganizationSwitcher, UserButton } from '@clerk/clerk-react';

interface AppHeaderProps {
  currentUser: User | null;
  currentView: string;
  onNavigate: (page: string) => void;
  onBack: () => void;
  onLoginClick?: () => void;
  hideNav?: boolean;
  className?: string;
}

const ADMIN_EMAILS = ['enverphoto@gmail.com', 'enver.isliamov@yandex.com'];

export const AppHeader: React.FC<AppHeaderProps> = ({ 
    currentUser, 
    currentView, 
    onNavigate, 
    onBack, 
    onLoginClick, 
    hideNav = false,
    className 
}) => {
  const { t } = useLanguage();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogoClick = () => {
      if (!currentUser) {
          onBack(); 
      } else {
          onNavigate('DASHBOARD');
      }
  };

  const isAdmin = currentUser?.email && ADMIN_EMAILS.includes(currentUser.email);

  const navItems = ['workflow', 'ai', 'pricing', 'about'];

  return (
    <>
        <header className={`h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/50 backdrop-blur-md flex items-center justify-between px-4 sticky top-0 z-50 transition-all ${className || ''}`}>
            <div className="flex items-center gap-6 overflow-hidden flex-1">
                
                {/* LOGO AREA */}
                <div 
                    className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity group"
                    onClick={handleLogoClick}
                >
                    <img 
                        src="/logo.png" 
                        alt={t('app.name')} 
                        className="w-8 h-8 shrink-0 group-hover:scale-105 transition-transform" 
                    />
                    <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">{t('app.name')}</span>
                </div>

                {!hideNav && <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800 hidden md:block"></div>}

                {/* Desktop Navigation */}
                {!hideNav && (
                    <div className="hidden md:flex items-center gap-2">
                        {navItems.map(page => {
                        const pageKey = page === 'ai' ? 'AI_FEATURES' : page.toUpperCase();
                        const isActive = currentView === pageKey;
                        return (
                            <button 
                                key={page}
                                onClick={() => onNavigate(pageKey)}
                                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all
                                    ${isActive 
                                        ? 'text-indigo-600 bg-indigo-50 dark:text-white dark:bg-zinc-800' 
                                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
                                    }
                                `}
                            >
                                {t(`nav.${page}`)}
                            </button>
                        );
                    })}
                    {!currentUser && (
                        <button 
                            onClick={() => onNavigate('LIVE_DEMO')}
                            className="px-3 py-1.5 text-sm font-bold text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 rounded-lg transition-all hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                        >
                            <PlayCircle size={14} /> {t('nav.demo')}
                        </button>
                    )}
                    </div>
                )}
            </div>
            
            {/* Right Side */}
            <div className="flex items-center gap-3 md:gap-5">
                
                {/* ADMIN BUTTON (Visible only to admins) */}
                {isAdmin && !hideNav && (
                    <button 
                        onClick={() => onNavigate('ADMIN')}
                        className="flex items-center gap-2 px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black rounded-lg text-xs font-bold shadow-lg hover:opacity-90 transition-opacity"
                        title="Admin Dashboard"
                    >
                        <Shield size={14} />
                        <span className="hidden md:inline">Admin</span>
                    </button>
                )}

                {/* Organization Switcher */}
                {currentUser && !hideNav && (
                    <div className="hidden md:block">
                        <OrganizationSwitcher 
                            hidePersonal={false}
                            afterCreateOrganizationUrl="#"
                            appearance={{
                                elements: {
                                    rootBox: "flex items-center",
                                    organizationSwitcherTrigger: "flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-sm font-medium text-zinc-700 dark:text-zinc-200 bg-transparent",
                                    organizationPreviewTextContainer: "hidden lg:block",
                                    organizationPreviewAvatarContainer: "shrink-0",
                                }
                            }}
                        />
                    </div>
                )}

                {/* Standardized User Button (Replaces manual profile chip) */}
                {currentUser && (
                    <UserButton 
                        afterSignOutUrl="/"
                        userProfileMode="modal"
                        appearance={{
                            elements: {
                                avatarBox: "w-8 h-8 rounded-full border border-zinc-200 dark:border-zinc-700 hover:border-indigo-500 transition-colors"
                            }
                        }}
                    />
                )}

                {/* Login Button (If Logged Out) */}
                {!currentUser && (
                    <button 
                        onClick={onLoginClick || (() => onBack())} 
                        className="text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 px-4 py-1.5 rounded-lg transition-colors hidden md:block shadow-lg shadow-indigo-900/20"
                    >
                        {t('nav.login')}
                    </button>
                )}

                <ThemeToggle />
                <LanguageSelector />

                {/* Mobile Menu Toggle */}
                {!hideNav && (
                    <button 
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className="md:hidden text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white p-1"
                    >
                        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                )}
            </div>
        </header>

        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && !hideNav && (
            <div className="md:hidden fixed top-16 left-0 right-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 z-40 p-4 flex flex-col gap-2 shadow-2xl animate-in slide-in-from-top-2">
                {navItems.map(page => {
                    const pageKey = page === 'ai' ? 'AI_FEATURES' : page.toUpperCase();
                    const isActive = currentView === pageKey;
                    return (
                        <button 
                            key={page}
                            onClick={() => {
                                setIsMobileMenuOpen(false);
                                onNavigate(pageKey);
                            }}
                            className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors
                                ${isActive ? 'bg-zinc-100 dark:bg-zinc-800 text-indigo-600 dark:text-white' : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white'}
                            `}
                        >
                            {t(`nav.${page}`)}
                        </button>
                    );
                })}
                
                {isAdmin && (
                    <button 
                        onClick={() => { setIsMobileMenuOpen(false); onNavigate('ADMIN'); }}
                        className="w-full text-left px-4 py-3 rounded-lg text-sm font-bold bg-black dark:bg-white text-white dark:text-black flex items-center gap-2"
                    >
                        <Shield size={16} /> Admin Panel
                    </button>
                )}

                {currentUser && (
                    <div className="px-4 py-3">
                        <div className="text-xs font-bold text-zinc-500 uppercase mb-2">Organization</div>
                        <OrganizationSwitcher 
                            hidePersonal={false}
                            afterCreateOrganizationUrl="#"
                            appearance={{
                                elements: {
                                    rootBox: "w-full",
                                    organizationSwitcherTrigger: "w-full flex items-center justify-between px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900",
                                }
                            }}
                        />
                    </div>
                )}

                <div className="h-px bg-zinc-200 dark:bg-zinc-800 my-1"></div>
                
                {currentUser ? (
                    <div className="flex items-center gap-2 px-4 py-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                        <UserButton afterSignOutUrl="/" />
                        <span className="text-sm font-bold text-zinc-800 dark:text-white">{currentUser.name}</span>
                    </div>
                ) : (
                    <button 
                        onClick={() => {
                            setIsMobileMenuOpen(false);
                            if (onLoginClick) onLoginClick();
                            else onBack();
                        }}
                        className="w-full text-left px-4 py-3 rounded-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
                    >
                        {t('nav.login')}
                    </button>
                )}
            </div>
        )}
    </>
  );
};
