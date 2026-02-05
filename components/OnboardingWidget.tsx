
import React from 'react';
import { Check, Plus, Upload, Share2, X, ArrowRight, Layout, CheckCircle2, ChevronRight, Sparkles } from 'lucide-react';
import { Project } from '../types';

interface OnboardingWidgetProps {
    projects: Project[];
    variant: 'full' | 'compact';
    onDismiss: () => void;
    onCreateProject: () => void;
    onGoToProject: () => void;
    onInvite: () => void; // Usually just goes to project for now
    hide: boolean;
}

export const OnboardingWidget: React.FC<OnboardingWidgetProps> = ({ 
    projects, 
    variant, 
    onDismiss, 
    onCreateProject, 
    onGoToProject,
    onInvite,
    hide
}) => {
    // Logic
    const hasProjects = projects.length > 0;
    const hasAssets = projects.some(p => p.assets.length > 0);
    const hasInvites = projects.some(p => (p.team && p.team.length > 1) || p.publicAccess === 'view');
    
    const progress = (Number(hasProjects) + Number(hasAssets) + Number(hasInvites)) / 3 * 100;
    const isComplete = hasProjects && hasAssets && hasInvites;

    if (hide || isComplete) return null;

    // --- COMPACT VIEW (Floating Bar) ---
    if (variant === 'compact') {
        let activeStepInfo = { title: '', action: () => {}, btnText: '' };
        if (!hasProjects) activeStepInfo = { title: '1. Create Project', action: onCreateProject, btnText: 'Create' };
        else if (!hasAssets) activeStepInfo = { title: '2. Upload Media', action: onGoToProject, btnText: 'Upload' };
        else activeStepInfo = { title: '3. Share & Review', action: onInvite, btnText: 'Share' };

        return (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] animate-in slide-in-from-bottom-10 fade-in duration-500 w-[90%] max-w-md">
                <div className="bg-zinc-900/90 backdrop-blur-md border border-zinc-700 rounded-2xl p-3 shadow-2xl flex items-center gap-4 relative overflow-hidden ring-1 ring-white/10">
                    <button onClick={onDismiss} className="absolute top-2 right-2 text-zinc-500 hover:text-white"><X size={12} /></button>
                    
                    {/* Progress Circle */}
                    <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                            <path className="text-zinc-800" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                            <path className="text-indigo-500 transition-all duration-1000 ease-out" strokeDasharray={`${progress}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                        </svg>
                        <div className="absolute text-[9px] font-bold text-white">{Math.round(progress)}%</div>
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider mb-0.5">Next Step</div>
                        <div className="text-sm font-bold text-white truncate flex items-center gap-2">
                            {activeStepInfo.title}
                        </div>
                    </div>

                    <button 
                        onClick={activeStepInfo.action}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-1 shrink-0"
                    >
                        {activeStepInfo.btnText} <ChevronRight size={12} />
                    </button>
                </div>
            </div>
        );
    }

    // --- FULL VIEW (Dashboard Cards) ---
    return (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8 mb-8 shadow-xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 group/widget">
            <button 
                onClick={onDismiss}
                className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-white p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors z-20 opacity-0 group-hover/widget:opacity-100"
                title="Dismiss Guide"
            >
                <X size={16} />
            </button>
            
            {/* Background Decoration */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-100 dark:bg-indigo-500/20 rounded-xl text-indigo-600 dark:text-indigo-400">
                        <Sparkles size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-zinc-900 dark:text-white leading-none mb-1">Get Started</h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">Complete setup to unlock full potential</p>
                    </div>
                </div>
                
                {/* Progress Bar */}
                <div className="flex items-center gap-3 min-w-[200px]">
                    <div className="flex-1 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-500 transition-all duration-700 ease-out rounded-full" 
                          style={{ width: `${progress}%` }}
                        />
                    </div>
                    <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 w-8 text-right">{Math.round(progress)}%</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10">
                {/* Step 1: Create Project */}
                <div className={`
                      border rounded-2xl p-5 flex flex-col items-start relative transition-all duration-300
                      ${hasProjects 
                          ? 'border-green-200 dark:border-green-500/20 bg-green-50/50 dark:bg-green-900/5' 
                          : 'border-indigo-500 ring-1 ring-indigo-500 shadow-lg shadow-indigo-500/10 bg-white dark:bg-zinc-800/50'
                      }
                `}>
                    <div className={`mb-3 p-2 rounded-lg shadow-sm ${hasProjects ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600'}`}>
                        {hasProjects ? <Check size={18} /> : <Plus size={18} />}
                    </div>
                    
                    <h4 className={`font-bold text-sm mb-1 ${hasProjects ? 'text-green-700 dark:text-green-400' : 'text-zinc-900 dark:text-white'}`}>1. Create Project</h4>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mb-4 leading-relaxed flex-1">
                        Initialize a workspace for your media assets.
                    </p>
                    
                    {hasProjects ? (
                        <div className="mt-auto w-full py-2 bg-green-100/50 dark:bg-green-900/10 text-green-700 dark:text-green-400 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-default">
                            <CheckCircle2 size={14} /> Completed
                        </div>
                    ) : (
                        <button 
                            onClick={onCreateProject}
                            className="mt-auto w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all"
                        >
                            Create Now <ArrowRight size={12} />
                        </button>
                    )}
                </div>

                {/* Step 2: Upload */}
                <div className={`
                      border rounded-2xl p-5 flex flex-col items-start relative transition-all duration-300
                      ${hasAssets 
                          ? 'border-green-200 dark:border-green-500/20 bg-green-50/50 dark:bg-green-900/5' 
                          : hasProjects
                              ? 'border-indigo-500 ring-1 ring-indigo-500 shadow-lg shadow-indigo-500/10 bg-white dark:bg-zinc-800/50'
                              : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30 opacity-60 grayscale'
                      }
                `} onClick={() => !hasAssets && hasProjects && onGoToProject()}>
                    
                    <div className={`mb-3 p-2 rounded-lg shadow-sm ${hasAssets ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                        {hasAssets ? <Check size={18} /> : <Upload size={18} />}
                    </div>
                    
                    <h4 className={`font-bold text-sm mb-1 ${hasAssets ? 'text-green-700 dark:text-green-400' : hasProjects ? 'text-zinc-900 dark:text-white' : 'text-zinc-500'}`}>2. Upload Media</h4>
                    <p className="text-[11px] text-zinc-500 mb-4 leading-relaxed flex-1">
                        Drag & drop video files. We create proxies instantly.
                    </p>
                    
                    {hasAssets ? (
                        <div className="mt-auto w-full py-2 bg-green-100/50 dark:bg-green-900/10 text-green-700 dark:text-green-400 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-default">
                            <CheckCircle2 size={14} /> Completed
                        </div>
                    ) : (
                        <button 
                            disabled={!hasProjects}
                            className={`mt-auto w-full py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${hasProjects ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-md' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500 cursor-not-allowed'}`}
                        >
                            {hasProjects ? 'Go to Project' : 'Waiting...'}
                        </button>
                    )}
                </div>

                {/* Step 3: Invite */}
                <div className={`
                      border rounded-2xl p-5 flex flex-col items-start relative transition-all duration-300
                      ${hasInvites
                          ? 'border-green-200 dark:border-green-500/20 bg-green-50/50 dark:bg-green-900/5' 
                          : hasAssets
                              ? 'border-indigo-500 ring-1 ring-indigo-500 shadow-lg shadow-indigo-500/10 bg-white dark:bg-zinc-800/50'
                              : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30 opacity-60 grayscale'
                      }
                `} onClick={() => !hasInvites && hasAssets && onInvite()}>
                    
                    <div className={`mb-3 p-2 rounded-lg shadow-sm ${hasInvites ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                        {hasInvites ? <Check size={18} /> : <Share2 size={18} />}
                    </div>
                    
                    <h4 className={`font-bold text-sm mb-1 ${hasInvites ? 'text-green-700 dark:text-green-400' : hasAssets ? 'text-zinc-900 dark:text-white' : 'text-zinc-500'}`}>3. Share & Review</h4>
                    <p className="text-[11px] text-zinc-500 mb-4 leading-relaxed flex-1">
                        Share link with clients or invite editors.
                    </p>
                    
                    {hasInvites ? (
                        <div className="mt-auto w-full py-2 bg-green-100/50 dark:bg-green-900/10 text-green-700 dark:text-green-400 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-default">
                            <CheckCircle2 size={14} /> Completed
                        </div>
                    ) : (
                        <button 
                            disabled={!hasAssets}
                            className={`mt-auto w-full py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${hasAssets ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-md' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500 cursor-not-allowed'}`}
                        >
                            {hasAssets ? 'Invite Team' : 'Waiting...'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
