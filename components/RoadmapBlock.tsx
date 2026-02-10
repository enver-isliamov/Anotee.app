
import React, { useState, useEffect } from 'react';
import { Lock, Check, Zap, Infinity as InfinityIcon, Loader2, CreditCard, Calendar } from 'lucide-react';
import { useLanguage } from '../services/i18n';
import { useAuth } from '@clerk/clerk-react';
import { useSubscription } from '../hooks/useSubscription';

export const RoadmapBlock: React.FC = () => {
  const { t } = useLanguage();
  const { getToken, isSignedIn } = useAuth();
  const { isPro, plan } = useSubscription();
  const [isBuying, setIsBuying] = useState<string | null>(null);
  const [prices, setPrices] = useState({ lifetime: 4900, monthly: 490 });

  useEffect(() => {
      // Fetch dynamic prices
      const loadPrices = async () => {
          if (!isSignedIn) return;
          try {
              const token = await getToken();
              const res = await fetch('/api/admin?action=get_payment_config', {
                  headers: { 'Authorization': `Bearer ${token}` }
              });
              if (res.ok) {
                  const data = await res.json();
                  if (data.prices) {
                      setPrices({
                          lifetime: data.prices.lifetime || 4900,
                          monthly: data.prices.monthly || 490
                      });
                  }
              }
          } catch(e) {
              // ignore
          }
      };
      loadPrices();
  }, [isSignedIn, getToken]);

  const handleBuy = async (planType: 'lifetime' | 'monthly') => {
      if (!isSignedIn) {
          alert("Please sign in to purchase.");
          return;
      }
      
      setIsBuying(planType);
      try {
          const token = await getToken();
          const res = await fetch('/api/payment?action=init', {
              method: 'POST',
              headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify({ planType })
          });
          
          const data = await res.json();
          
          if (res.ok && data.confirmationUrl) {
              window.location.href = data.confirmationUrl;
          } else {
              alert("Payment initialization failed: " + (data.error || "Unknown error"));
              setIsBuying(null);
          }
      } catch (e) {
          console.error(e);
          alert("Network error");
          setIsBuying(null);
      }
  };

  const isLifetimePlan = plan === 'lifetime';
  const isMonthlyPlan = plan === 'pro' && !isLifetimePlan;

  return (
    <div id="roadmap-block" className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto text-left">
        {/* Card 1: Monthly Pro */}
        <div className={`bg-zinc-50 dark:bg-zinc-900 border rounded-3xl p-6 relative overflow-hidden group transition-all shadow-xl flex flex-col ${isMonthlyPlan ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-zinc-200 dark:border-zinc-800 hover:border-indigo-500/50'}`}>
            {isMonthlyPlan && (
                <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl z-20">
                    CURRENT PLAN
                </div>
            )}
            
            <div className="flex justify-between items-center mb-6">
                <span className="bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider border border-zinc-300 dark:border-zinc-700">
                    Pro Subscription
                </span>
            </div>
            
            <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Monthly</h3>
            <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold text-zinc-900 dark:text-white">{prices.monthly}₽</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-600 ml-2">/ month</span>
            </div>

            <div className="space-y-4 mb-8">
                <div className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 mt-0.5"><Check size={12} /></div>
                    <p className="text-sm text-zinc-500 dark:text-zinc-300">Unlimited Projects</p>
                </div>
                <div className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 mt-0.5"><Check size={12} /></div>
                    <p className="text-sm text-zinc-500 dark:text-zinc-300">Export (XML, CSV, EDL)</p>
                </div>
                <div className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 mt-0.5"><Check size={12} /></div>
                    <p className="text-sm text-zinc-500 dark:text-zinc-300">4K Support</p>
                </div>
            </div>

            <div className="mt-auto pt-4 border-t border-zinc-200 dark:border-zinc-800/50">
                {!isPro ? (
                    <button 
                        onClick={() => handleBuy('monthly')}
                        disabled={!!isBuying}
                        className="w-full py-3.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isBuying === 'monthly' ? <Loader2 size={16} className="animate-spin" /> : <Calendar size={16} />}
                        {isBuying === 'monthly' ? 'Processing...' : 'Subscribe'}
                    </button>
                ) : isMonthlyPlan ? (
                    <div className="w-full py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-default">
                        <Check size={16} /> Active
                    </div>
                ) : (
                    <div className="w-full py-3 text-center text-xs text-zinc-500">
                        Included in Lifetime
                    </div>
                )}
            </div>
        </div>

        {/* Card 2: Founder's Club (Lifetime) - ACTIVE */}
        <div className={`bg-white dark:bg-zinc-900 border rounded-3xl p-6 relative overflow-hidden group transition-all shadow-xl dark:shadow-2xl flex flex-col ${isLifetimePlan ? 'border-green-500 ring-1 ring-green-500' : 'border-green-400 dark:border-green-600/50 hover:border-green-500 dark:hover:border-green-500 shadow-green-500/10'}`}>
            {isLifetimePlan && (
                <div className="absolute top-0 right-0 bg-green-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl z-20">
                    OWNER
                </div>
            )}
            <div className="absolute top-0 right-0 p-4 opacity-50 pointer-events-none">
                <div className="w-32 h-32 bg-green-500/10 rounded-full blur-3xl"></div>
            </div>
            
            <div className="flex justify-between items-center mb-6">
                <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider border border-green-200 dark:border-green-500/20 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                    LIMITED OFFER
                </span>
            </div>

            <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">{t('rm.founders_club')}</h3>
            <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold text-zinc-900 dark:text-white">{prices.lifetime}₽</span>
                <span className="text-xs text-green-600 dark:text-green-400 font-medium ml-2 uppercase">{t('rm.one_time')}</span>
            </div>

            <div className="space-y-4 mb-8">
                <div className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 mt-0.5"><InfinityIcon size={12} /></div>
                    <div>
                        <p className="text-sm text-zinc-800 dark:text-zinc-200 font-medium">{t('rm.lifetime_license')}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{t('rm.lifetime_desc')}</p>
                    </div>
                </div>
                <div className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 mt-0.5"><Zap size={12} /></div>
                    <div>
                        <p className="text-sm text-zinc-800 dark:text-zinc-200 font-medium">Prioritized Support</p>
                        <p className="text-xs text-zinc-500 mt-0.5">Direct access to dev team</p>
                    </div>
                </div>
            </div>

            <div className="mt-auto pt-4 border-t border-zinc-200 dark:border-zinc-800/50">
                {!isLifetimePlan ? (
                    <button 
                        onClick={() => handleBuy('lifetime')}
                        disabled={!!isBuying}
                        className="w-full py-3.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-green-500/30 flex items-center justify-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
                    >
                        {isBuying === 'lifetime' ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                        {isBuying === 'lifetime' ? 'Processing...' : 'Buy Lifetime'}
                    </button>
                ) : (
                    <div className="w-full py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-default">
                        <Check size={16} /> You own this
                    </div>
                )}
            </div>
        </div>

        {/* Locked Card - Team/Enterprise */}
        <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/50 rounded-3xl p-6 relative opacity-80 hover:opacity-100 transition-opacity grayscale hover:grayscale-0 flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <span className="bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider border border-zinc-300 dark:border-zinc-700">
                    Phase 3
                </span>
                <Lock size={16} className="text-zinc-400 dark:text-zinc-600" />
            </div>
            
            <h3 className="text-xl font-bold text-zinc-700 dark:text-zinc-300 mb-2">Team Plan</h3>
            <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold text-zinc-400">---</span>
            </div>

            <div className="space-y-4 mb-8">
                <div className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-600 mt-0.5"><Check size={12} /></div>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">Multiple Seats</p>
                </div>
                <div className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-600 mt-0.5"><Check size={12} /></div>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">SSO & Audit Logs</p>
                </div>
            </div>

            <div className="mt-auto space-y-2 text-xs border-t border-zinc-200 dark:border-zinc-800/50 pt-4">
                <div className="flex justify-between">
                    <span className="text-zinc-500 dark:text-zinc-600">{t('rm.status')}</span>
                    <span className="text-zinc-400 dark:text-zinc-500 flex items-center gap-1"><Lock size={10} /> {t('rm.locked')}</span>
                </div>
            </div>
        </div>
    </div>
  );
};
