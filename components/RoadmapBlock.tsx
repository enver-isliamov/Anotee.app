
import React, { useState } from 'react';
import { Lock, Check, Zap, Infinity as InfinityIcon, Loader2, CreditCard } from 'lucide-react';
import { useLanguage } from '../services/i18n';
import { useAuth } from '@clerk/clerk-react';
import { useSubscription } from '../hooks/useSubscription';

export const RoadmapBlock: React.FC = () => {
  const { t } = useLanguage();
  const { getToken, isSignedIn } = useAuth();
  const { isPro } = useSubscription();
  const [isBuying, setIsBuying] = useState(false);

  const handleBuy = async () => {
      if (!isSignedIn) {
          alert("Please sign in to purchase.");
          return;
      }
      
      setIsBuying(true);
      try {
          const token = await getToken();
          // CHANGED: Using consolidated endpoint
          const res = await fetch('/api/payment?action=init', {
              method: 'POST',
              headers: {
                  'Authorization': `Bearer ${token}`
              }
          });
          
          const data = await res.json();
          
          if (res.ok && data.confirmationUrl) {
              window.location.href = data.confirmationUrl;
          } else {
              alert("Payment initialization failed: " + (data.error || "Unknown error"));
              setIsBuying(false);
          }
      } catch (e) {
          console.error(e);
          alert("Network error");
          setIsBuying(false);
      }
  };

  return (
    <div id="roadmap-block" className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto text-left">
        {/* Active Card - Founder's Club */}
        <div className={`bg-white dark:bg-zinc-900 border rounded-3xl p-6 relative overflow-hidden group transition-all shadow-xl dark:shadow-2xl flex flex-col ${isPro ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-green-400 dark:border-green-600/50 hover:border-green-500 dark:hover:border-green-500 shadow-green-500/10'}`}>
            {isPro && (
                <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl z-20">
                    CURRENT PLAN
                </div>
            )}
            <div className="absolute top-0 right-0 p-4 opacity-50 pointer-events-none">
                <div className="w-32 h-32 bg-green-500/10 rounded-full blur-3xl"></div>
            </div>
            
            <div className="flex justify-between items-center mb-6">
                <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider border border-green-200 dark:border-green-500/20 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                    {t('rm.phase_1')}
                </span>
            </div>

            <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">{t('rm.founders_club')}</h3>
            <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold text-zinc-900 dark:text-white">2900₽</span>
                <span className="text-sm text-zinc-400 dark:text-zinc-500 line-through ml-2">4900₽</span>
                <span className="text-xs text-green-600 dark:text-green-400 font-medium ml-2 uppercase">{t('rm.founder_sale')}</span>
            </div>

            <div className="space-y-4 mb-8">
                <div className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 mt-0.5"><Check size={12} /></div>
                    <div>
                        <p className="text-sm text-zinc-800 dark:text-zinc-200 font-medium">{t('rm.lifetime_license')}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{t('rm.lifetime_desc')}</p>
                    </div>
                </div>
                <div className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 mt-0.5"><Zap size={12} /></div>
                    <div>
                        <p className="text-sm text-zinc-800 dark:text-zinc-200 font-medium">{t('rm.flash_loom')} <span className="text-[9px] bg-zinc-100 dark:bg-zinc-800 px-1 rounded text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">CORE</span></p>
                        <p className="text-xs text-zinc-500 mt-0.5">{t('rm.sync_desc')}</p>
                    </div>
                </div>
                <div className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 mt-0.5"><InfinityIcon size={12} /></div>
                    <div>
                        <p className="text-sm text-zinc-800 dark:text-zinc-200 font-medium">{t('rm.unlimited')}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{t('rm.unlimited_desc')}</p>
                    </div>
                </div>
            </div>

            <div className="mt-auto pt-4 border-t border-zinc-200 dark:border-zinc-800/50">
                {!isPro ? (
                    <button 
                        onClick={handleBuy}
                        disabled={isBuying}
                        className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] ring-4 ring-indigo-500/10 animate-in fade-in zoom-in duration-300"
                    >
                        {isBuying ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                        {isBuying ? 'Обработка...' : 'Купить за 2900₽'}
                    </button>
                ) : (
                    <div className="w-full py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-default">
                        <Check size={16} /> Уже активировано
                    </div>
                )}
                
                <div className="mt-3 flex justify-between text-[10px] text-zinc-500 dark:text-zinc-600">
                    <span>{t('rm.status')} <span className="text-green-600 dark:text-green-400 font-bold">{t('rm.open')}</span></span>
                    <span>{t('rm.users_150')}</span>
                </div>
            </div>
        </div>

        {/* Locked Card 1 - Early Adopter */}
        <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/50 rounded-3xl p-6 relative opacity-80 hover:opacity-100 transition-opacity grayscale hover:grayscale-0 flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <span className="bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider border border-zinc-300 dark:border-zinc-700">
                    {t('rm.phase_2')}
                </span>
                <Lock size={16} className="text-zinc-400 dark:text-zinc-600" />
            </div>
            
            <h3 className="text-xl font-bold text-zinc-700 dark:text-zinc-300 mb-2">{t('rm.early_adopter')}</h3>
            <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold text-zinc-400">4900₽</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-600 ml-2">{t('rm.one_time')}</span>
            </div>

            <div className="space-y-4 mb-8">
                <div className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-600 mt-0.5"><Check size={12} /></div>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('rm.access_v1')}</p>
                </div>
                <div className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-600 mt-0.5"><Check size={12} /></div>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('rm.std_support')}</p>
                </div>
            </div>

            <div className="mt-auto space-y-2 text-xs border-t border-zinc-200 dark:border-zinc-800/50 pt-4">
                <div className="flex justify-between">
                    <span className="text-zinc-500 dark:text-zinc-600">{t('rm.status')}</span>
                    <span className="text-zinc-400 dark:text-zinc-500 flex items-center gap-1"><Lock size={10} /> {t('rm.locked')}</span>
                </div>
            </div>
        </div>

        {/* Locked Card 2 - SaaS */}
        <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/50 rounded-3xl p-6 relative opacity-80 hover:opacity-100 transition-opacity grayscale hover:grayscale-0 flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <span className="bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider border border-zinc-300 dark:border-zinc-700">
                    {t('rm.phase_3')}
                </span>
                <Lock size={16} className="text-zinc-400 dark:text-zinc-600" />
            </div>
            
            <h3 className="text-xl font-bold text-zinc-700 dark:text-zinc-300 mb-2">{t('rm.saas_launch')}</h3>
            <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold text-zinc-400">4800₽</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-600 ml-2">{t('rm.per_year')}</span>
            </div>

            <div className="space-y-4 mb-8">
                <div className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-600 mt-0.5"><Check size={12} /></div>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('rm.monthly_pay')}</p>
                </div>
            </div>

            <div className="mt-auto space-y-2 text-xs border-t border-zinc-200 dark:border-zinc-800/50 pt-4">
                <div className="flex justify-between">
                    <span className="text-zinc-500 dark:text-zinc-600">{t('rm.status')}</span>
                    <span className="text-zinc-400 dark:text-zinc-500">{t('rm.end_2026')}</span>
                </div>
            </div>
        </div>
    </div>
  );
};
