
import React from 'react';
import { User } from '../types';
import { ArrowRight, UserPlus, ShieldCheck, PlayCircle, Zap, Clock, Check, BarChart3, MousePointer2, Layers, Shield, Share2, Upload, MessageSquare, Download, Rocket, Server, Heart, Code2 } from 'lucide-react';
import { useLanguage } from '../services/i18n';
import { AppHeader } from './AppHeader';
import { RoadmapBlock } from './RoadmapBlock';
import { IntegrationBlock } from './StaticPages';
import { SignInButton } from '@clerk/clerk-react';

interface LoginProps {
  onLogin: (user: User, token?: string) => void;
  onNavigate: (page: string) => void;
}

const LoginCard: React.FC = () => {
    const { t } = useLanguage();

    return (
        <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200/50 dark:border-zinc-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden w-full max-w-sm mx-auto animate-in zoom-in-95 duration-300 transition-colors">
            <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-500"></div>
            <div className="mb-6">
                <div className="flex items-start gap-3">
                    <div className="bg-indigo-50 dark:bg-indigo-500/10 p-2 rounded-lg text-indigo-600 dark:text-indigo-400 shrink-0"><ShieldCheck size={20} /></div>
                    <div>
                        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{t('auth.card.login')}</h2>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{t('auth.card.desc_login')}</p>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <SignInButton mode="modal">
                     <button className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-500/20 group">
                         <span>{t('auth.btn.login')}</span>
                         <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                     </button>
                </SignInButton>
                
                <p className="text-center text-[10px] text-zinc-400 dark:text-zinc-600">
                    Secured by Clerk & Google
                </p>
            </div>
        </div>
    );
};

export const Login: React.FC<LoginProps> = ({ onNavigate }) => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen w-full bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white selection:bg-indigo-500/30 transition-colors duration-500">
      
      <AppHeader 
        currentUser={null}
        currentView="LANDING"
        onNavigate={onNavigate}
        onBack={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        onLoginClick={() => document.getElementById('auth-section')?.scrollIntoView({ behavior: 'smooth' })}
      />

      <div className="relative py-20 px-4 md:py-32 overflow-hidden">
            {/* Background Gradients */}
            <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-300/20 dark:bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none mix-blend-multiply dark:mix-blend-normal"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-300/20 dark:bg-purple-600/10 rounded-full blur-[120px] pointer-events-none mix-blend-multiply dark:mix-blend-normal"></div>

            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
                
                {/* Text Content */}
                <div className="lg:col-span-7 space-y-8 animate-in slide-in-from-bottom-8 duration-700">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[10px] uppercase font-bold tracking-widest text-zinc-600 dark:text-zinc-400 shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        <span>Anotee v1.0</span>
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
                    <LoginCard />
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
                            <div className="text-xs text-indigo-200">Anotee</div>
                        </div>
                    </div>
                </div>
        </div>

        {/* SECTION: WORKFLOW */}
        <div className="py-24 max-w-7xl mx-auto px-4 border-b border-zinc-200 dark:border-zinc-800">
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

        {/* FOOTER */}
        <footer className="mt-16 py-8 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-3 gap-8 text-center md:text-left">
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
  );
};
