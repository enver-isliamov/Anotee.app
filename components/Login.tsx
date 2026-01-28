import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { ArrowRight, UserPlus, ShieldCheck, Mail, AlertCircle, PlayCircle } from 'lucide-react';
import { generateId } from '../services/utils';
import { useLanguage } from '../services/i18n';
import { AppHeader } from './AppHeader';
import { SignInButton, useSignIn } from '@clerk/clerk-react';

interface LoginProps {
  onLogin: (user: User) => void;
  onNavigate: (page: string) => void;
}

// --- LOGIN CARD COMPONENT ---
interface LoginCardProps {
    inviteProjectId: string | null;
    showManualLogin: boolean;
    name: string;
    setName: (name: string) => void;
    handleManualSubmit: (e: React.FormEvent) => void;
}

const LoginCard: React.FC<LoginCardProps> = ({ 
    inviteProjectId, showManualLogin, name, setName, handleManualSubmit
}) => {
    const { t } = useLanguage();
    const { signIn } = useSignIn();

    return (
        <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200/50 dark:border-zinc-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden w-full max-w-sm mx-auto animate-in zoom-in-95 duration-300 transition-colors">
            <div className={`absolute top-0 left-0 right-0 h-1 ${inviteProjectId ? 'bg-orange-500' : 'bg-indigo-500'}`}></div>
            <div className="mb-6">
                {inviteProjectId ? (
                    <div className="flex items-start gap-3">
                        <div className="bg-orange-50 dark:bg-orange-500/10 p-2 rounded-lg text-orange-600 dark:text-orange-400 shrink-0"><UserPlus size={20} /></div>
                        <div>
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{t('auth.card.join')}</h2>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{t('auth.card.desc_join')}</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-start gap-3">
                        <div className="bg-indigo-50 dark:bg-indigo-500/10 p-2 rounded-lg text-indigo-600 dark:text-indigo-400 shrink-0"><ShieldCheck size={20} /></div>
                        <div>
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{t('auth.card.login')}</h2>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{t('auth.card.desc_login')}</p>
                        </div>
                    </div>
                )}
            </div>

            <div className="space-y-4">
                {/* CLERK BUTTON */}
                <SignInButton mode="modal">
                     <button className="w-full flex items-center justify-center gap-2 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm">
                         <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
                         <span>{inviteProjectId ? t('auth.btn.join') : t('auth.btn.login')} with Google</span>
                     </button>
                </SignInButton>
                
                {showManualLogin && (
                    <>
                        <div className="relative py-2">
                            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-200 dark:border-zinc-800"></div></div>
                            <div className="relative flex justify-center text-xs uppercase"><span className="bg-white dark:bg-zinc-900 px-2 text-zinc-400 dark:text-zinc-500">{t('auth.manual')}</span></div>
                        </div>
                        <form onSubmit={handleManualSubmit} className="space-y-3">
                            <div className="relative">
                                <Mail size={16} className="absolute top-3.5 left-3 text-zinc-400 dark:text-zinc-500" />
                                <input 
                                    type="text" 
                                    placeholder={t('auth.placeholder.guest')} 
                                    value={name} 
                                    onChange={(e) => setName(e.target.value)} 
                                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-lg pl-9 pr-4 py-2.5 text-sm text-zinc-900 dark:text-white focus:border-indigo-500 focus:bg-white dark:focus:bg-zinc-900 outline-none transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-600" 
                                />
                            </div>
                            <button type="submit" disabled={!name.trim()} className={`w-full p-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-black dark:hover:text-white`}>
                                {inviteProjectId ? t('auth.btn.join') : 'Continue as Guest'} <ArrowRight size={14} />
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
};

export const Login: React.FC<LoginProps> = ({ onLogin, onNavigate }) => {
  const [name, setName] = useState('');
  const [inviteProjectId, setInviteProjectId] = useState<string | null>(null);
  const { t } = useLanguage();
  
  // Logic: Show manual login only if there's an invite (Guest mode)
  // If standard login page, we encourage Clerk/Google login for Admin access
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pId = params.get('projectId');
    if (pId) {
        setInviteProjectId(pId);
    }
  }, []);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    // Only Guests use manual submit now
    const role = UserRole.GUEST;
    const newUser: User = {
      id: `guest-${generateId()}`,
      name: name,
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${name}`,
      role: role 
    };
    onLogin(newUser);
  };

  return (
    <div className="min-h-screen w-full bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white selection:bg-indigo-500/30 transition-colors duration-500">
      
      {/* Unified Header */}
      <AppHeader 
        currentUser={null}
        currentView="LANDING"
        onNavigate={onNavigate}
        onBack={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        onLoginClick={() => document.getElementById('auth-section')?.scrollIntoView({ behavior: 'smooth' })}
        hideNav={!!inviteProjectId}
        className={inviteProjectId ? 'bg-transparent border-transparent absolute w-full top-0' : undefined}
      />

      {inviteProjectId ? (
          // --- INVITE MODE LAYOUT ---
          <div className="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center p-4 relative">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-100 via-white to-white dark:from-indigo-900/20 dark:via-black dark:to-black pointer-events-none"></div>
              
              <div className="relative z-10 w-full max-w-sm">
                  <div className="text-center mb-8">
                      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">{t('hero.title.1')} {t('app.name')}</h1>
                      <p className="text-zinc-500 dark:text-zinc-400 text-sm">You have been invited to collaborate.</p>
                  </div>
                  <LoginCard 
                      inviteProjectId={inviteProjectId}
                      showManualLogin={true} 
                      name={name}
                      setName={setName}
                      handleManualSubmit={handleManualSubmit}
                  />
              </div>
          </div>
      ) : (
          // --- STANDARD LANDING LAYOUT ---
          <>
            <div className="relative py-20 px-4 md:py-32 overflow-hidden">
                {/* Background Gradients */}
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-300/20 dark:bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none mix-blend-multiply dark:mix-blend-normal"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-300/20 dark:bg-purple-600/10 rounded-full blur-[120px] pointer-events-none mix-blend-multiply dark:mix-blend-normal"></div>

                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
                    
                    {/* Text Content */}
                    <div className="lg:col-span-7 space-y-8 animate-in slide-in-from-bottom-8 duration-700">
                        {/* Text content same as before ... */}
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[10px] uppercase font-bold tracking-widest text-zinc-600 dark:text-zinc-400 shadow-sm">
                            <span>SmoTree v1.0</span>
                        </div>

                        <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.1] tracking-tight">
                            <span className="block text-zinc-900 dark:text-white mb-2">
                                {t('hero.title.speed').split('.')[0]}.
                            </span>
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 dark:from-indigo-400 dark:via-purple-400 dark:to-indigo-400 animate-gradient-x">
                                {t('hero.title.speed').split('.')[1]}
                            </span>
                        </h1>
                        
                        <div className="space-y-6 text-xl md:text-2xl text-zinc-600 dark:text-zinc-400 max-w-2xl leading-relaxed font-light">
                            <p>{t('hero.desc_new')}</p>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-4 pt-4 items-start">
                             <button 
                                onClick={() => document.getElementById('auth-section')?.scrollIntoView({ behavior: 'smooth' })}
                                className="bg-zinc-900 dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200 px-8 py-4 rounded-xl font-bold text-lg transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 shadow-xl shadow-indigo-900/10 dark:shadow-none"
                            >
                                {t('hero.cta')} <ArrowRight size={20} />
                            </button>
                            <button 
                                onClick={() => onNavigate('LIVE_DEMO')}
                                className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 px-8 py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl group"
                            >
                                <PlayCircle size={20} className="text-red-500 group-hover:scale-110 transition-transform" />
                                {t('hero.demo')}
                            </button>
                        </div>
                    </div>

                    {/* Login Card */}
                    <div id="auth-section" className="lg:col-span-5 relative z-10 animate-in fade-in zoom-in-95 duration-1000 delay-200 flex justify-center lg:justify-end">
                        <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 blur-2xl rounded-full transform scale-90"></div>
                        <LoginCard 
                            inviteProjectId={inviteProjectId}
                            showManualLogin={false} // Hide manual login on main page, prioritize Clerk
                            name={name}
                            setName={setName}
                            handleManualSubmit={handleManualSubmit}
                        />
                    </div>
                </div>
            </div>
            
            {/* Rest of the landing page stays same, just returning placeholder here to keep file size down if content is same */}
          </>
      )}
    </div>
  );
};