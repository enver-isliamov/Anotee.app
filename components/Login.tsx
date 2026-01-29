
import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { ArrowRight, UserPlus, ShieldCheck, Mail, PlayCircle, Zap, Clock, Check, BarChart3, MousePointer2, Layers, Shield, Share2, Upload, MessageSquare, Download, Rocket, Loader2 } from 'lucide-react';
import { generateId } from '../services/utils';
import { useLanguage } from '../services/i18n';
import { AppHeader } from './AppHeader';
import { RoadmapBlock } from './RoadmapBlock';
import { IntegrationBlock } from './StaticPages';
import { SignInButton, useSignIn } from '@clerk/clerk-react';

interface LoginProps {
  onLogin: (user: User, token?: string) => void;
  onNavigate: (page: string) => void;
}

// --- LOGIN CARD COMPONENT ---
interface LoginCardProps {
    inviteProjectId: string | null;
    showManualLogin: boolean;
    name: string;
    setName: (name: string) => void;
    handleManualSubmit: (e: React.FormEvent) => void;
    isLoading?: boolean;
}

const LoginCard: React.FC<LoginCardProps> = ({ 
    inviteProjectId, showManualLogin, name, setName, handleManualSubmit, isLoading
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
                            <button type="submit" disabled={!name.trim() || isLoading} className={`w-full p-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-black dark:hover:text-white`}>
                                {isLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                                {inviteProjectId ? t('auth.btn.join') : 'Continue as Guest'} {!isLoading && <ArrowRight size={14} />}
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
  const [isLoading, setIsLoading] = useState(false);
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

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setIsLoading(true);
    try {
        const res = await fetch('/api/guest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });

        const data = await res.json();
        
        if (data.success && data.user && data.token) {
            onLogin(data.user, data.token);
        } else {
            alert("Login failed: " + (data.error || "Unknown error"));
        }
    } catch (err) {
        console.error(err);
        alert("Connection error");
    } finally {
        setIsLoading(false);
    }
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
                      isLoading={isLoading}
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
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[10px] uppercase font-bold tracking-widest text-zinc-600 dark:text-zinc-400 shadow-sm">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
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
                            isLoading={isLoading}
                        />
                    </div>
                </div>
            </div>

            {/* INTEGRATION BLOCK */}
            <IntegrationBlock />

            {/* SECTION: STATS (SPEED) */}
            <div className="py-24 bg-white dark:bg-zinc-900 border-y border-zinc-200 dark:border-zinc-800 relative overflow-hidden">
                 <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-2 gap-12 items-center">
                     <div>
                         <div className="inline-block p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg text-indigo-600 dark:text-indigo-400 mb-6"><Zap size={24} /></div>
                         <h2 className="text-3xl font-bold text-zinc-900 dark:text-white mb-4">{t('land.speed.title')}</h2>
                         <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6">{t('land.speed.sub')}</p>
                         <div className="flex gap-4">
                             <div className="bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl flex-1">
                                 <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mb-1">92%</div>
                                 <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">{t('land.stat.92')}</div>
                             </div>
                             <div className="bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl flex-1">
                                 <div className="text-3xl font-bold text-green-600 dark:text-green-500 mb-1">0</div>
                                 <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">{t('land.stat.0')}</div>
                             </div>
                         </div>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                         <div className="bg-zinc-100 dark:bg-black p-6 rounded-2xl flex flex-col items-center text-center justify-center aspect-square border border-zinc-200 dark:border-zinc-800">
                             <Clock size={32} className="text-zinc-400 mb-2" />
                             <div className="text-sm font-bold text-zinc-500 line-through">5 Days</div>
                             <div className="text-xs text-zinc-400">Traditional</div>
                         </div>
                         <div className="bg-indigo-600 p-6 rounded-2xl flex flex-col items-center text-center justify-center aspect-square shadow-xl shadow-indigo-900/20 text-white">
                             <Zap size={32} className="mb-2 text-yellow-300" />
                             <div className="text-lg font-bold">4 Hours</div>
                             <div className="text-xs text-indigo-200">SmoTree</div>
                         </div>
                     </div>
                 </div>
            </div>

            {/* SECTION: WORKFLOW */}
            <div className="py-24 max-w-7xl mx-auto px-4">
                <div className="text-center mb-16 max-w-2xl mx-auto">
                    <h2 className="text-3xl font-bold text-zinc-900 dark:text-white mb-4">{t('land.flow.title')}</h2>
                    <p className="text-zinc-600 dark:text-zinc-400">{t('land.flow.sub')}</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    {[
                        { icon: Upload, title: t('page.workflow.step1'), desc: t('page.workflow.step1.desc'), color: 'text-blue-500' },
                        { icon: Share2, title: t('page.workflow.step2'), desc: t('page.workflow.step2.desc'), color: 'text-indigo-500' },
                        { icon: MessageSquare, title: t('page.workflow.step3'), desc: t('page.workflow.step3.desc'), color: 'text-purple-500' },
                        { icon: Download, title: t('page.workflow.step4'), desc: t('page.workflow.step4.desc'), color: 'text-green-500' },
                    ].map((step, i) => (
                        <div key={i} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl hover:border-indigo-500/30 transition-all group shadow-sm hover:shadow-md">
                            <div className={`w-12 h-12 rounded-xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center mb-4 ${step.color} group-hover:scale-110 transition-transform`}>
                                <step.icon size={24} />
                            </div>
                            <h3 className="font-bold text-zinc-900 dark:text-white mb-2">{step.title}</h3>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{step.desc}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* SECTION: ROI / CHART */}
            <div className="py-24 bg-zinc-50 dark:bg-black border-y border-zinc-200 dark:border-zinc-800">
                <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-2 gap-16 items-center">
                    <div className="order-2 md:order-1">
                        <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xl">
                             <div className="space-y-6">
                                 {/* Bar 1 */}
                                 <div>
                                     <div className="flex justify-between text-xs font-bold text-zinc-500 mb-2 uppercase">
                                         <span>{t('land.chart.wa')}</span>
                                         <span>Slow</span>
                                     </div>
                                     <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-4 overflow-hidden">
                                         <div className="bg-red-400 h-full w-[20%]"></div>
                                     </div>
                                 </div>
                                 {/* Bar 2 */}
                                 <div>
                                     <div className="flex justify-between text-xs font-bold text-zinc-500 mb-2 uppercase">
                                         <span>{t('land.chart.cloud')}</span>
                                         <span>Medium</span>
                                     </div>
                                     <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-4 overflow-hidden">
                                         <div className="bg-yellow-400 h-full w-[50%]"></div>
                                     </div>
                                 </div>
                                 {/* Bar 3 */}
                                 <div>
                                     <div className="flex justify-between text-xs font-bold text-indigo-500 mb-2 uppercase">
                                         <span>{t('land.chart.pro')}</span>
                                         <span>Fast</span>
                                     </div>
                                     <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-4 overflow-hidden relative">
                                         <div className="bg-indigo-600 h-full w-[95%] shadow-[0_0_15px_rgba(79,70,229,0.5)]"></div>
                                     </div>
                                 </div>
                             </div>
                        </div>
                    </div>
                    <div className="order-1 md:order-2">
                        <div className="inline-block p-2 bg-green-50 dark:bg-green-500/10 rounded-lg text-green-600 dark:text-green-400 mb-6"><BarChart3 size={24} /></div>
                        <h2 className="text-3xl font-bold text-zinc-900 dark:text-white mb-4">{t('land.roi.title')}</h2>
                        <ul className="space-y-4">
                            <li className="flex items-start gap-3">
                                <Check size={20} className="text-green-500 shrink-0 mt-0.5" />
                                <span className="text-zinc-600 dark:text-zinc-400">{t('land.roi.94')}</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <Check size={20} className="text-green-500 shrink-0 mt-0.5" />
                                <span className="text-zinc-600 dark:text-zinc-400">{t('land.roi.0ms')}</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* SECTION: WHY SMOTREE */}
            <div className="py-24 max-w-7xl mx-auto px-4">
                <div className="text-center mb-16">
                     <h2 className="text-3xl font-bold text-zinc-900 dark:text-white">{t('why.title')}</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                     {/* Card 1 */}
                     <div className="p-8 rounded-3xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-indigo-500/50 transition-colors">
                         <div className="w-12 h-12 bg-white dark:bg-black rounded-xl flex items-center justify-center shadow-sm mb-6 text-indigo-600">
                             <MousePointer2 size={24} />
                         </div>
                         <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-3">{t('why.feat1.title')}</h3>
                         <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed text-sm">{t('why.feat1.desc')}</p>
                     </div>
                     {/* Card 2 */}
                     <div className="p-8 rounded-3xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-indigo-500/50 transition-colors">
                         <div className="w-12 h-12 bg-white dark:bg-black rounded-xl flex items-center justify-center shadow-sm mb-6 text-blue-600">
                             <Layers size={24} />
                         </div>
                         <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-3">{t('why.feat2.title')}</h3>
                         <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed text-sm">{t('why.feat2.desc')}</p>
                     </div>
                     {/* Card 3 */}
                     <div className="p-8 rounded-3xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-indigo-500/50 transition-colors">
                         <div className="w-12 h-12 bg-white dark:bg-black rounded-xl flex items-center justify-center shadow-sm mb-6 text-green-600">
                             <Shield size={24} />
                         </div>
                         <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-3">{t('why.feat3.title')}</h3>
                         <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed text-sm">{t('why.feat3.desc')}</p>
                     </div>
                </div>
            </div>

            {/* SECTION: PRICING / ROADMAP (RESTORED) */}
            <div className="py-24 bg-zinc-50 dark:bg-black border-y border-zinc-200 dark:border-zinc-800">
                <div className="max-w-7xl mx-auto px-4 text-center">
                    <h2 className="text-3xl font-bold text-zinc-900 dark:text-white mb-4">{t('roadmap.title')}</h2>
                    <p className="text-zinc-600 dark:text-zinc-400 mb-12 max-w-2xl mx-auto">{t('roadmap.subtitle')}</p>
                    <RoadmapBlock />
                </div>
            </div>

            {/* SECTION: FINAL CTA (RESTORED) */}
            <div className="py-24 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 overflow-hidden relative">
                <div className="max-w-5xl mx-auto px-4 text-center relative z-10">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl text-indigo-600 dark:text-indigo-400 mb-8 shadow-lg shadow-indigo-900/10 ring-1 ring-indigo-500/20">
                         <Rocket size={32} />
                    </div>
                    <h2 className="text-4xl md:text-5xl font-bold text-zinc-900 dark:text-white mb-8 tracking-tight">
                        {t('land.try_now')}
                    </h2>
                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        <button 
                            onClick={() => document.getElementById('auth-section')?.scrollIntoView({ behavior: 'smooth' })}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 shadow-xl shadow-indigo-900/20"
                        >
                            {t('hero.cta')} <ArrowRight size={20} />
                        </button>
                    </div>
                </div>
                {/* Background Decor */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-gradient-to-r from-indigo-500/10 to-purple-500/10 blur-[120px] rounded-full pointer-events-none"></div>
            </div>

            {/* FOOTER */}
            <footer className="py-12 border-t border-zinc-200 dark:border-zinc-800 text-center">
                 <div className="text-sm font-bold text-zinc-900 dark:text-white mb-2">{t('app.name')}</div>
                 <div className="text-xs text-zinc-500">
                     &copy; {new Date().getFullYear()} {t('footer.rights')}
                 </div>
            </footer>
          </>
      )}
    </div>
  );
};
