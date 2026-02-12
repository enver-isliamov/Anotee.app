
import React, { useState } from 'react';
import { Menu, X, PlayCircle, Shield, Settings, CircleHelp } from 'lucide-react';
import { useLanguage } from '../services/i18n';
import { LanguageSelector } from './LanguageSelector';
import { User } from '../types';
import { OrganizationSwitcher, UserButton } from '@clerk/clerk-react';
import logo from '../logo.svg';

interface AppHeaderProps {
  currentUser: User | null;
  currentView: string;
  onNavigate: (page: string) => void;
  onBack: () => void;
  onLoginClick?: () => void;
  onStartTour?: () => void; // Added prop
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
    onStartTour,
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
        <header className={`h-16 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md flex items-center justify-between px-4 sticky top-0 z-50 transition-all ${className || ''}`}>
            <div className="flex items-center gap-6 overflow-hidden flex-1">
                
                {/* LOGO AREA */}
                <div 
                    className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity group"
                    onClick={handleLogoClick}
                >
                    <img 
                        src={logo} 
                        alt={t('app.name')} 
                        className="w-8 h-8 shrink-0 group-hover:scale-105 transition-transform" 
                    />
                    <span className="text-lg font-bold text-zinc-100 tracking-tight">{t('app.name')}</span>
                </div>

                {!hideNav && <div className="h-6 w-px bg-zinc-800 hidden md:block"></div>}

                {/* Desktop Navigation */}
                {!hideNav && (
                    <div className="hidden md:flex items-center gap-2">
                        {navItems.map(page => {
                        const pageKey = page === 'ai' ? 'AI_FEATURES' : page.toUpperCase();
                        const isActive = currentView === pageKey;
                        const href = page === 'ai' ? '/ai' : `/${page}`;
                        return (
                            <a 
                                key={page}
                                href={href}
                                onClick={(e) => { e.preventDefault(); onNavigate(pageKey); }}
                                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all
                                    ${isActive 
                                        ? 'text-white bg-zinc-800' 
                                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                                    }
                                `}
                            >
                                {t(`nav.${page}`)}
                            </a>
                        );
                    })}
                    {!currentUser && (
                        <a 
                            href="/demo"
                            onClick={(e) => { e.preventDefault(); onNavigate('LIVE_DEMO'); }}
                            className="px-3 py-1.5 text-sm font-bold text-red-400 hover:text-red-300 rounded-lg transition-all hover:bg-red-900/20 flex items-center gap-2"
                        >
                            <PlayCircle size={14} /> {t('nav.demo')}
                        </a>
                    )}
                    </div>
                )}
            </div>
            
            {/* Right Side */}
            <div className="flex items-center gap-3 md:gap-5">
                
                {/* Unified User Controls (Desktop Only) */}
                {currentUser && (
                    <div className="hidden md:flex items-center gap-2 pl-2">
                        {/* Settings Link */}
                        <a 
                            id="tour-profile-btn"
                            href="/profile"
                            onClick={(e) => { e.preventDefault(); onNavigate('PROFILE'); }}
                            className={`p-2 rounded-full transition-colors ${currentView === 'PROFILE' ? 'bg-indigo-500/20 text-indigo-400' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
                            title="Subscription & Settings"
                        >
                            <Settings size={20} />
                        </a>

                        {/* Combined Identity Block */}
                        <div className="flex items-center bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 rounded-full pl-1 pr-1 py-1 transition-all">
                            {!hideNav && (
                                <div className="hidden md:block scale-90 origin-right mr-2">
                                    <OrganizationSwitcher 
                                        hidePersonal={false}
                                        afterCreateOrganizationUrl="#"
                                        appearance={{
                                            elements: {
                                                rootBox: "flex items-center",
                                                organizationSwitcherTrigger: "flex items-center gap-2 px-2 py-1 rounded-lg hover:text-white transition-colors text-xs font-medium text-zinc-300 bg-transparent focus:shadow-none",
                                                organizationPreviewTextContainer: "hidden lg:block max-w-[100px] truncate",
                                                organizationPreviewAvatarContainer: "shrink-0",
                                                userPreviewMainIdentifier: "text-white",
                                                userPreviewSecondaryIdentifier: "text-zinc-400"
                                            }
                                        }}
                                    />
                                </div>
                            )}
                            <UserButton 
                                afterSignOutUrl="/"
                                userProfileMode="modal"
                                appearance={{
                                    elements: {
                                        avatarBox: "w-8 h-8 rounded-full border-2 border-zinc-900 hover:border-indigo-500 transition-colors"
                                    }
                                }}
                            />
                        </div>
                    </div>
                )}

                {/* Login Button (Desktop Only) */}
                {!currentUser && (
                    <button 
                        onClick={onLoginClick || (() => onBack())} 
                        className="text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 px-4 py-1.5 rounded-lg transition-colors hidden md:block shadow-lg shadow-indigo-900/20"
                    >
                        {t('nav.login')}
                    </button>
                )}

                {/* Language Selector (Desktop Only) */}
                <div className="hidden md:block">
                    <LanguageSelector />
                </div>
                
                {/* TOUR TRIGGER BUTTON (Desktop Only) */}
                {currentUser && onStartTour && (
                    <button 
                        onClick={onStartTour}
                        className="p-2 rounded-lg text-zinc-400 hover:text-indigo-400 hover:bg-zinc-800 transition-colors hidden md:block"
                        title="Start Tour / Help"
                    >
                        <CircleHelp size={20} />
                    </button>
                )}

                {/* Mobile Menu Toggle */}
                {!hideNav && (
                    <button 
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className="md:hidden text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800"
                    >
                        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                )}
            </div>
        </header>

        {/* Mobile Menu Dropdown (Fullscreen on small screens) */}
        {isMobileMenuOpen && !hideNav && (
            <div className="md:hidden fixed top-16 left-0 right-0 bottom-0 bg-zinc-900/95 backdrop-blur-xl border-t border-zinc-800 z-40 p-4 flex flex-col gap-2 animate-in slide-in-from-top-2 overflow-y-auto">
                {/* Navigation Links */}
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
                            className={`w-full text-left px-4 py-3 rounded-xl text-base font-bold transition-colors
                                ${isActive ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}
                            `}
                        >
                            {t(`nav.${page}`)}
                        </button>
                    );
                })}
                
                {/* Mobile Tour Button */}
                {currentUser && onStartTour && (
                    <button 
                        onClick={() => { setIsMobileMenuOpen(false); onStartTour(); }}
                        className="w-full text-left px-4 py-3 rounded-xl text-base font-bold text-indigo-400 hover:bg-zinc-800 flex items-center gap-2"
                    >
                        <CircleHelp size={20} /> Показать обучение
                    </button>
                )}

                {isAdmin && (
                    <button 
                        onClick={() => { setIsMobileMenuOpen(false); onNavigate('ADMIN'); }}
                        className="w-full text-left px-4 py-3 rounded-xl text-base font-bold bg-white text-black flex items-center gap-2 shadow-lg"
                    >
                        <Shield size={20} /> Admin Panel
                    </button>
                )}

                <div className="h-px bg-zinc-800 my-2"></div>

                {/* USER CONTROL CENTER (Mobile) */}
                {currentUser && (
                    <div className="space-y-3">
                        {/* Profile Link */}
                        <button 
                            onClick={() => { setIsMobileMenuOpen(false); onNavigate('PROFILE'); }}
                            className="w-full text-left px-4 py-3 rounded-xl text-sm font-bold bg-zinc-800 text-white flex items-center gap-3 hover:bg-zinc-700 transition-colors"
                        >
                            <Settings size={18} className="text-zinc-400" />
                            Профиль и Подписка
                        </button>

                        {/* Org Switcher Card */}
                        <div className="px-4 py-3 bg-zinc-950 rounded-xl border border-zinc-800">
                            <div className="text-[10px] font-bold text-zinc-500 uppercase mb-2 tracking-wider">Организация</div>
                            <OrganizationSwitcher 
                                hidePersonal={false}
                                afterCreateOrganizationUrl="#"
                                appearance={{
                                    elements: {
                                        rootBox: "w-full",
                                        organizationSwitcherTrigger: "w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-zinc-800 bg-zinc-900 text-white hover:bg-zinc-800 transition-colors",
                                        organizationPreviewTextContainer: "flex-1 text-left",
                                        organizationPreviewMainIdentifier: "text-sm font-bold",
                                        organizationPreviewSecondaryIdentifier: "text-xs text-zinc-500"
                                    }
                                }}
                            />
                        </div>

                        {/* User Identity Row */}
                        <div className="flex items-center gap-3 px-4 py-3 bg-zinc-800 rounded-xl border border-zinc-700/50">
                            <div className="scale-110">
                                <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: "w-10 h-10" } }} />
                            </div>
                            <div className="flex flex-col overflow-hidden">
                                <span className="text-sm font-bold text-white truncate">{currentUser.name}</span>
                                <span className="text-xs text-zinc-400 truncate">{currentUser.email}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Login Action (Mobile) */}
                {!currentUser && (
                    <button 
                        onClick={() => {
                            setIsMobileMenuOpen(false);
                            if (onLoginClick) onLoginClick();
                            else onBack();
                        }}
                        className="w-full text-center px-4 py-4 rounded-xl text-base font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-900/30"
                    >
                        {t('nav.login')}
                    </button>
                )}

                {/* Mobile Language Selector (Bottom) */}
                <div className="mt-auto pt-4 border-t border-zinc-800 flex items-center justify-between px-2 pb-6">
                     <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Язык интерфейса</span>
                     <div className="scale-110 origin-right">
                        <LanguageSelector />
                     </div>
                </div>
            </div>
        )}
    </>
  );
};
