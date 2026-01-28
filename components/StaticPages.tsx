
import React from 'react';
import { Upload, Share2, MessageSquare, Download, Film, Terminal, ArrowRight, Code2, Heart, Zap, Layout, User as UserIcon, Rocket, Shield, Server, Columns, ShieldCheck, Timer, History, Lock, PenTool, Layers, Sparkles, Search } from 'lucide-react';
import { useLanguage } from '../services/i18n';
import { RoadmapBlock } from './RoadmapBlock';

// Simplified Props - No navigation logic needed inside content components
export const WorkflowPage: React.FC = () => {
    const { t } = useLanguage();
    const steps = [
        { icon: Upload, title: t('page.workflow.step1'), desc: t('page.workflow.step1.desc') },
        { icon: Share2, title: t('page.workflow.step2'), desc: t('page.workflow.step2.desc') },
        { icon: MessageSquare, title: t('page.workflow.step3'), desc: t('page.workflow.step3.desc') },
        { icon: Download, title: t('page.workflow.step4'), desc: t('page.workflow.step4.desc') },
    ];

    return (
        <div className="max-w-5xl mx-auto py-8">
             <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-white mb-12 text-center">{t('page.workflow.title')}</h1>
             
             {/* Compact Node-based Workflow */}
             <div className="flex flex-col md:flex-row items-stretch justify-center gap-6 mb-24 relative">
                {steps.map((step, idx) => (
                    <React.Fragment key={idx}>
                        <div className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 flex flex-col items-center text-center hover:border-indigo-500/30 transition-all group min-w-[200px] shadow-sm hover:shadow-md">
                             <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-500/10 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors text-zinc-500 dark:text-zinc-400">
                                 <step.icon size={24} />
                             </div>
                             <h3 className="text-base font-bold text-zinc-900 dark:text-white mb-2">{step.title}</h3>
                             <p className="text-sm text-zinc-600 dark:text-zinc-500 leading-relaxed">{step.desc}</p>
                        </div>
                        
                        {idx < steps.length - 1 && (
                            <div className="flex items-center justify-center text-zinc-300 dark:text-zinc-700">
                                <ArrowRight size={24} className="rotate-90 md:rotate-0 opacity-50" />
                            </div>
                        )}
                    </React.Fragment>
                ))}
             </div>

             {/* Section 2: Technical Docs */}
             <div className="border-t border-zinc-200 dark:border-zinc-900 pt-12 transition-colors">
                 <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-8 flex items-center gap-3">
                    <Terminal size={24} className="text-indigo-600 dark:text-indigo-500"/>
                    {t('page.docs.title')}
                 </h2>
                 <div className="grid md:grid-cols-2 gap-6">
                     <div className="bg-zinc-50 dark:bg-zinc-900/50 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800/50">
                         <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-300 mb-4 flex items-center gap-2">
                             <Film size={18} className="text-indigo-600 dark:text-indigo-400"/> Formats
                         </h3>
                         <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('page.docs.formats')}</p>
                     </div>
                     
                     <div className="bg-zinc-50 dark:bg-zinc-900/50 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800/50">
                         <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-300 mb-4 flex items-center gap-2">
                             <Terminal size={18} className="text-green-600 dark:text-green-400"/> Shortcuts
                         </h3>
                         <div className="font-mono text-xs space-y-2 text-zinc-600 dark:text-zinc-400">
                             <div className="flex justify-between"><span>Play / Pause</span><span className="text-zinc-400 dark:text-zinc-200">Space</span></div>
                             <div className="flex justify-between"><span>Rewind / Forward</span><span className="text-zinc-400 dark:text-zinc-200">J / L</span></div>
                             <div className="flex justify-between"><span>Set In / Out</span><span className="text-zinc-400 dark:text-zinc-200">I / O</span></div>
                             <div className="flex justify-between"><span>Marker</span><span className="text-zinc-400 dark:text-zinc-200">M</span></div>
                             <div className="flex justify-between"><span>Fullscreen</span><span className="text-zinc-400 dark:text-zinc-200">F</span></div>
                         </div>
                     </div>

                     <div className="bg-zinc-50 dark:bg-zinc-900/50 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800/50 md:col-span-2">
                         <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-300 mb-4 flex items-center gap-2">
                             <Download size={18} className="text-orange-500 dark:text-orange-400"/> DaVinci Resolve Workflow
                         </h3>
                         <div className="text-sm text-zinc-600 dark:text-zinc-400 space-y-2">
                             <p>1. Export markers from SmoTree as <strong>.xml</strong>.</p>
                             <p>2. Open DaVinci Resolve. Go to <strong>File {'>'} Import {'>'} Timeline</strong>.</p>
                             <p>3. Select the downloaded XML.</p>
                             <p>4. The markers will appear as a new timeline or overlay on your clips.</p>
                         </div>
                     </div>
                 </div>
             </div>
        </div>
    );
};

export const AboutPage: React.FC = () => {
    const { t } = useLanguage();
    return (
        <div className="flex flex-col gap-12 max-w-5xl mx-auto py-8">
            
            {/* 1. Hero / Mission */}
            <div className="bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-900/50 dark:to-transparent border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 md:p-16 text-center shadow-lg dark:shadow-2xl relative overflow-hidden transition-colors">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500"></div>
                
                <h2 className="text-3xl md:text-5xl font-bold text-zinc-900 dark:text-white mb-6 leading-tight">
                    {t('hero.title.speed')}
                </h2>
                <div className="inline-block px-4 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-bold mb-8 shadow-sm">
                    <span className="text-indigo-600 dark:text-indigo-400">SmoTree</span> Mission
                </div>
                <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
                    {t('hero.desc_new')}
                </p>
            </div>

            {/* 2. 10x Faster Feature Banner (Redesigned) */}
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/80 p-10 md:p-16 rounded-3xl flex flex-col justify-center items-center text-center relative overflow-hidden group shadow-2xl transition-colors">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50 dark:from-indigo-900/20 via-white dark:via-zinc-950 to-white dark:to-zinc-950 pointer-events-none"></div>
                
                <div className="relative z-10">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl text-indigo-600 dark:text-indigo-400 mb-8 shadow-lg shadow-indigo-900/10 dark:shadow-indigo-900/20 ring-1 ring-indigo-500/20">
                        <Rocket size={32} />
                    </div>
                    <h2 className="text-3xl md:text-5xl font-bold text-zinc-900 dark:text-white mb-6 tracking-tight">
                        {t('page.about.feat.fast.title').replace('SmoTree', '')} <span className="text-indigo-600 dark:text-indigo-400">SmoTree</span>
                    </h2>
                    <p className="text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto text-lg leading-relaxed font-light">
                        {t('page.about.feat.fast.desc')}
                    </p>
                </div>
            </div>

            {/* 3. Key Values Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl flex flex-col items-center text-center hover:border-indigo-500/20 transition-all group shadow-sm hover:shadow-md">
                    <div className="p-3 bg-yellow-50 dark:bg-zinc-950 rounded-xl mb-4 text-yellow-600 dark:text-yellow-500 group-hover:scale-110 transition-transform shadow-lg shadow-yellow-500/10">
                        <Timer size={24} />
                    </div>
                    <h3 className="font-bold text-zinc-900 dark:text-white mb-2">{t('why.feat1.title')}</h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-500 leading-relaxed">{t('why.feat1.desc')}</p>
                </div>
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl flex flex-col items-center text-center hover:border-indigo-500/20 transition-all group shadow-sm hover:shadow-md">
                    <div className="p-4 bg-blue-50 dark:bg-zinc-950 rounded-xl mb-4 text-blue-600 dark:text-blue-500 group-hover:scale-110 transition-transform shadow-lg shadow-blue-500/10">
                        <History size={24} />
                    </div>
                    <h3 className="font-bold text-zinc-900 dark:text-white mb-2">{t('why.feat2.title')}</h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-500 leading-relaxed">{t('why.feat2.desc')}</p>
                </div>
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl flex flex-col items-center text-center hover:border-indigo-500/20 transition-all group shadow-sm hover:shadow-md">
                    <div className="p-3 bg-green-50 dark:bg-zinc-950 rounded-xl mb-4 text-green-600 dark:text-green-500 group-hover:scale-110 transition-transform shadow-lg shadow-green-500/10">
                        <Lock size={24} />
                    </div>
                    <h3 className="font-bold text-zinc-900 dark:text-white mb-2">{t('why.feat3.title')}</h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-500 leading-relaxed">{t('why.feat3.desc')}</p>
                </div>
            </div>

            {/* 4. Instant Playback & Tech Stack Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {/* Instant Playback Block (UPDATED for Light Mode) */}
                 <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl flex flex-col items-center text-center relative overflow-hidden justify-center hover:border-yellow-500/30 transition-colors shadow-lg dark:shadow-2xl">
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-500/10 rounded-full text-yellow-600 dark:text-yellow-500 mb-6 shadow-lg shadow-yellow-500/10 dark:shadow-[0_0_15px_rgba(234,179,8,0.2)]">
                        <Zap size={32} fill="currentColor" />
                    </div>
                    <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-3">
                        {t('page.about.feat.instant.title')}
                    </h3>
                    <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed text-sm">
                        {t('page.about.feat.instant.desc')}
                    </p>
                </div>

                {/* Tech Stack */}
                <div className="bg-zinc-50 dark:bg-zinc-900 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 flex flex-col shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-500/10 rounded-lg text-indigo-600 dark:text-indigo-500"><Code2 size={20} /></div>
                        <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Technology</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {['React 19', 'TypeScript', 'Tailwind', 'Vercel Blob', 'Postgres', 'Vite'].map(tech => (
                            <div key={tech} className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-4 py-3 rounded-xl text-sm text-zinc-600 dark:text-zinc-400 font-mono text-center hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-default shadow-sm">
                                {tech}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 5. The Solo Story (Full Width Conclusion) */}
            <div className="bg-white dark:bg-zinc-900 p-8 md:p-12 rounded-3xl border border-zinc-200 dark:border-zinc-800 flex flex-col items-center text-center shadow-lg transition-colors">
                <div className="p-3 bg-pink-100 dark:bg-pink-500/10 rounded-full text-pink-600 dark:text-pink-500 mb-6">
                    <Heart size={32} />
                </div>
                <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4">{t('page.about.story.title')}</h3>
                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-8 italic max-w-2xl text-lg">
                    "{t('page.about.story.text')}"
                </p>
                <div className="flex items-center gap-3 border-t border-zinc-100 dark:border-zinc-800/50 pt-6">
                    <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-md">S</div>
                    <div className="text-left">
                        <div className="text-sm font-bold text-zinc-900 dark:text-white">SmoTree Dev</div>
                        <div className="text-xs text-zinc-500 font-medium">Founder & Maker</div>
                    </div>
                </div>
            </div>

        </div>
    );
};

export const PricingPage: React.FC = () => {
    const { t } = useLanguage();
    return (
        <div className="max-w-5xl mx-auto py-8">
             <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-white mb-8 text-center">{t('page.pricing.title')}</h1>
             <div className="text-center mb-12">
                 <p className="text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto text-lg">{t('page.pricing.subtitle')}</p>
             </div>

             {/* Personal Message Block */}
             <div className="max-w-4xl mx-auto mb-16 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-500/20 rounded-2xl p-6 md:p-8 relative overflow-hidden shadow-sm transition-colors">
                 <div className="absolute top-0 right-0 p-4 opacity-5">
                     <Server size={120} />
                 </div>
                 <div className="relative z-10">
                     <h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-200 mb-3 flex items-center gap-2">
                         <Shield size={20} />
                         {t('page.pricing.why_title')}
                     </h3>
                     <p className="text-sm md:text-base text-indigo-800/80 dark:text-indigo-200/70 leading-relaxed max-w-3xl">
                         {t('page.pricing.why_text')}
                     </p>
                 </div>
             </div>

             <RoadmapBlock />
        </div>
    );
};

export const AiFeaturesPage: React.FC = () => {
    const { t } = useLanguage();

    const renderCard = (titleKey: string, descKey: string, benefitKey: string, badge: {text: string, color: string}, labelColor: string) => (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors h-full flex flex-col group shadow-sm hover:shadow-md">
            <div className="flex justify-between items-start mb-3">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{t(titleKey)}</h3>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${badge.color}`}>
                    {badge.text}
                </span>
            </div>
            <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-4 flex-1 leading-relaxed">
                {t(descKey)}
            </p>
            
            {/* Benefit Block - Higher contrast and less whitespace */}
            <div className="bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800/50 p-3 rounded-lg flex flex-col">
                <span className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${labelColor}`}>
                    {t(benefitKey).split(':')[0]}:
                </span>
                <span className="text-sm text-zinc-700 dark:text-zinc-300 font-medium leading-snug">
                    {t(benefitKey).split(':')[1]}
                </span>
            </div>
        </div>
    );

    return (
        <div className="max-w-[1400px] mx-auto py-12 px-4">
            <div className="text-center mb-16">
                <h1 className="text-3xl md:text-5xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">{t('page.ai.title')}</h1>
                <p className="text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto text-lg">{t('page.ai.subtitle')}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                {/* COLUMN 1: WORKFLOW */}
                <div>
                    <h2 className="text-xs font-bold text-indigo-600 dark:text-indigo-500 uppercase tracking-widest mb-4 flex items-center gap-2 px-1">
                        {t('page.ai.col1')}
                    </h2>
                    <div className="space-y-4">
                        {renderCard('page.ai.card1.title', 'page.ai.card1.desc', 'page.ai.card1.benefit', 
                            { text: 'FEATURE', color: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20' }, 'text-indigo-600 dark:text-indigo-400')}
                        
                        {renderCard('page.ai.card2.title', 'page.ai.card2.desc', 'page.ai.card2.benefit', 
                            { text: 'FEATURE', color: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20' }, 'text-indigo-600 dark:text-indigo-400')}
                    </div>
                </div>

                {/* COLUMN 2: INTELLIGENCE (AI) */}
                <div>
                    <h2 className="text-xs font-bold text-amber-600 dark:text-amber-500 uppercase tracking-widest mb-4 flex items-center gap-2 px-1">
                        {t('page.ai.col2')}
                    </h2>
                    <div className="space-y-4">
                        {renderCard('page.ai.card3.title', 'page.ai.card3.desc', 'page.ai.card3.benefit', 
                            { text: 'GEMINI API', color: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-500/20' }, 'text-amber-600 dark:text-amber-500')}
                        
                        {renderCard('page.ai.card4.title', 'page.ai.card4.desc', 'page.ai.card4.benefit', 
                            { text: 'SOON', color: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700' }, 'text-amber-600 dark:text-amber-500')}
                    </div>
                </div>

                {/* COLUMN 3: TECHNOLOGY (CORE) */}
                <div>
                    <h2 className="text-xs font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-widest mb-4 flex items-center gap-2 px-1">
                        {t('page.ai.col3')}
                    </h2>
                    <div className="space-y-4">
                        {renderCard('page.ai.card5.title', 'page.ai.card5.desc', 'page.ai.card5.benefit', 
                            { text: 'PERFORMANCE', color: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20' }, 'text-emerald-600 dark:text-emerald-500')}
                        
                        {renderCard('page.ai.card6.title', 'page.ai.card6.desc', 'page.ai.card6.benefit', 
                            { text: 'SECURITY', color: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20' }, 'text-emerald-600 dark:text-emerald-500')}
                    </div>
                </div>

            </div>
        </div>
    );
};
