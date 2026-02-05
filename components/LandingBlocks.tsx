
import React from 'react';
import { Upload, Share2, MessageSquare, Download, Clock, Zap, PenTool, Layers, Shield, Check } from 'lucide-react';
import { useLanguage } from '../services/i18n';

// --- BLOCK 1: WORKFLOW ---
export const WorkflowBlock: React.FC = () => {
    const { t } = useLanguage();
    
    const steps = [
        { icon: <Upload size={20} />, titleKey: 'page.workflow.step1', descKey: 'page.workflow.step1.desc' },
        { icon: <Share2 size={20} />, titleKey: 'page.workflow.step2', descKey: 'page.workflow.step2.desc' },
        { icon: <MessageSquare size={20} />, titleKey: 'page.workflow.step3', descKey: 'page.workflow.step3.desc' },
        { icon: <Download size={20} />, titleKey: 'page.workflow.step4', descKey: 'page.workflow.step4.desc' },
    ];

    return (
        <section className="py-24 bg-black relative border-t border-zinc-900">
            <div className="max-w-7xl mx-auto px-4">
                <div className="text-center mb-16 max-w-3xl mx-auto">
                    <h2 className="text-2xl md:text-3xl font-bold text-white mb-4 leading-tight">
                        {t('land.flow.title')}
                    </h2>
                    <p className="text-zinc-400 text-sm md:text-base">
                        {t('land.flow.sub')}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {steps.map((step, idx) => (
                        <div key={idx} className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-2xl hover:bg-zinc-900 hover:border-zinc-700 transition-colors group">
                            <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-indigo-400 mb-4 group-hover:scale-110 transition-transform">
                                {step.icon}
                            </div>
                            <h3 className="text-white font-bold mb-2 text-sm">{t(step.titleKey)}</h3>
                            <p className="text-zinc-500 text-xs leading-relaxed">
                                {t(step.descKey)}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

// --- BLOCK 2: ROI (CHART) ---
export const ROIBlock: React.FC = () => {
    const { t } = useLanguage();

    return (
        <section className="py-24 bg-zinc-900 border-y border-zinc-800">
            <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                
                {/* Left: Chart */}
                <div className="bg-black/50 p-8 rounded-3xl border border-white/5 space-y-6">
                    {/* Bar 1 */}
                    <div>
                        <div className="flex justify-between text-[10px] uppercase font-bold text-zinc-500 mb-2">
                            <span>{t('land.chart.wa')}</span>
                            <span>SLOW</span>
                        </div>
                        <div className="h-4 bg-zinc-800 rounded-full w-full overflow-hidden">
                            <div className="h-full bg-red-500/20 w-[20%]"></div>
                        </div>
                    </div>
                    {/* Bar 2 */}
                    <div>
                        <div className="flex justify-between text-[10px] uppercase font-bold text-zinc-500 mb-2">
                            <span>{t('land.chart.cloud')}</span>
                            <span>MEDIUM</span>
                        </div>
                        <div className="h-4 bg-zinc-800 rounded-full w-full overflow-hidden">
                            <div className="h-full bg-yellow-500/50 w-[45%]"></div>
                        </div>
                    </div>
                    {/* Bar 3 */}
                    <div>
                        <div className="flex justify-between text-[10px] uppercase font-bold text-indigo-400 mb-2">
                            <span>{t('land.chart.pro')}</span>
                            <span>FAST</span>
                        </div>
                        <div className="h-4 bg-zinc-800 rounded-full w-full overflow-hidden relative">
                            <div className="h-full bg-gradient-to-r from-indigo-600 to-purple-600 w-[95%] shadow-[0_0_15px_rgba(79,70,229,0.5)]"></div>
                        </div>
                    </div>
                </div>

                {/* Right: Text */}
                <div>
                    <div className="inline-block p-2 bg-green-500/10 rounded-lg text-green-400 mb-6 border border-green-500/20">
                        <Zap size={24} />
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-6">{t('land.roi.title')}</h2>
                    <ul className="space-y-4">
                        <li className="flex items-start gap-3">
                            <Check className="text-green-500 shrink-0 mt-1" size={18} />
                            <p className="text-zinc-400 text-sm">{t('land.roi.94')}</p>
                        </li>
                        <li className="flex items-start gap-3">
                            <Check className="text-green-500 shrink-0 mt-1" size={18} />
                            <p className="text-zinc-400 text-sm">{t('land.roi.0ms')}</p>
                        </li>
                    </ul>
                </div>
            </div>
        </section>
    );
};

// --- BLOCK 3: FEATURES (WHY) ---
export const FeaturesBlock: React.FC = () => {
    const { t } = useLanguage();

    const features = [
        { 
            icon: <PenTool size={24} />, 
            title: t('why.feat1.title'), 
            desc: t('why.feat1.desc'),
            color: 'text-indigo-400 bg-indigo-500/10'
        },
        { 
            icon: <Layers size={24} />, 
            title: t('why.feat2.title'), 
            desc: t('why.feat2.desc'),
            color: 'text-blue-400 bg-blue-500/10'
        },
        { 
            icon: <Shield size={24} />, 
            title: t('why.feat3.title'), 
            desc: t('why.feat3.desc'),
            color: 'text-green-400 bg-green-500/10'
        }
    ];

    return (
        <section className="py-24 bg-black">
            <div className="max-w-7xl mx-auto px-4">
                <h2 className="text-center text-3xl font-bold text-white mb-16">{t('why.title')}</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {features.map((feat, i) => (
                        <div key={i} className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl hover:border-zinc-700 transition-colors group">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 ${feat.color} group-hover:scale-110 transition-transform`}>
                                {feat.icon}
                            </div>
                            <h3 className="text-lg font-bold text-white mb-3">{feat.title}</h3>
                            <p className="text-sm text-zinc-400 leading-relaxed">
                                {feat.desc}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};
