
import React, { useState, useEffect } from 'react';
import { Lock, Check, Zap, Infinity as InfinityIcon, Loader2, CreditCard, Calendar } from 'lucide-react';
import { useLanguage } from '../services/i18n';
import { useAuth } from '@clerk/clerk-react';
import { useSubscription } from '../hooks/useSubscription';
import { PaymentConfig, DEFAULT_PAYMENT_CONFIG, PlanConfig } from '../types';

export const RoadmapBlock: React.FC = () => {
  const { t } = useLanguage();
  const { getToken, isSignedIn } = useAuth();
  const { isPro, plan } = useSubscription();
  const [isBuying, setIsBuying] = useState<string | null>(null);
  const [config, setConfig] = useState<PaymentConfig>(DEFAULT_PAYMENT_CONFIG);

  useEffect(() => {
      const loadConfig = async () => {
          if (!isSignedIn) return;
          try {
              const token = await getToken();
              const res = await fetch('/api/admin?action=get_payment_config', {
                  headers: { 'Authorization': `Bearer ${token}` }
              });
              if (res.ok) {
                  const data = await res.json();
                  // Merge with default to ensure structure exists
                  setConfig({ 
                      ...DEFAULT_PAYMENT_CONFIG, 
                      ...data,
                      plans: { ...DEFAULT_PAYMENT_CONFIG.plans, ...(data.plans || {}) }
                  });
              }
          } catch(e) {
              // ignore
          }
      };
      loadConfig();
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

  const isLifetimeUser = plan === 'lifetime';
  const isMonthlyUser = plan === 'pro' && !isLifetimeUser;

  // Render Helper for a generic Card
  const renderCard = (
      planKey: 'monthly' | 'lifetime' | 'team', 
      planData: PlanConfig, 
      userStatus: { isCurrent: boolean, isOwned: boolean }
  ) => {
      const { isActive, title, price, currency, features, phaseLabel } = planData;
      
      // Styling logic
      let borderColor = 'border-zinc-200 dark:border-zinc-800';
      let accentColor = 'text-zinc-900 dark:text-white';
      let btnColor = 'bg-zinc-800 hover:bg-zinc-700';
      let icon = <Check size={12} />;

      if (planKey === 'lifetime') {
          borderColor = userStatus.isCurrent ? 'border-green-500 ring-1 ring-green-500' : 'border-green-400 dark:border-green-600/50 hover:border-green-500';
          btnColor = 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500';
          icon = <InfinityIcon size={12} />;
      } else if (planKey === 'monthly') {
          borderColor = userStatus.isCurrent ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-zinc-200 dark:border-zinc-800 hover:border-indigo-500/50';
          btnColor = 'bg-indigo-600 hover:bg-indigo-500';
          icon = <Calendar size={12} />;
      }

      // Locked State
      if (!isActive) {
          return (
            <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/50 rounded-3xl p-6 relative opacity-80 hover:opacity-100 transition-opacity grayscale hover:grayscale-0 flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <span className="bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider border border-zinc-300 dark:border-zinc-700">
                        {phaseLabel || 'Locked'}
                    </span>
                    <Lock size={16} className="text-zinc-400 dark:text-zinc-600" />
                </div>
                <h3 className="text-xl font-bold text-zinc-700 dark:text-zinc-300 mb-2">{title}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-4xl font-bold text-zinc-400">---</span>
                </div>
                <div className="space-y-4 mb-8">
                    {features.map((f, i) => (
                        <div key={i} className="flex items-start gap-3">
                            <div className="p-1 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-600 mt-0.5"><Check size={12} /></div>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">{f}</p>
                        </div>
                    ))}
                </div>
                <div className="mt-auto space-y-2 text-xs border-t border-zinc-200 dark:border-zinc-800/50 pt-4">
                    <div className="flex justify-between">
                        <span className="text-zinc-500 dark:text-zinc-600">{t('rm.status')}</span>
                        <span className="text-zinc-400 dark:text-zinc-500 flex items-center gap-1"><Lock size={10} /> {t('rm.locked')}</span>
                    </div>
                </div>
            </div>
          );
      }

      // Active State
      return (
        <div className={`bg-white dark:bg-zinc-900 border rounded-3xl p-6 relative overflow-hidden group transition-all shadow-xl flex flex-col ${borderColor}`}>
            {userStatus.isCurrent && (
                <div className={`absolute top-0 right-0 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl z-20 ${planKey === 'lifetime' ? 'bg-green-600' : 'bg-indigo-600'}`}>
                    CURRENT PLAN
                </div>
            )}
            {planKey === 'lifetime' && (
                <div className="absolute top-0 right-0 p-4 opacity-50 pointer-events-none">
                    <div className="w-32 h-32 bg-green-500/10 rounded-full blur-3xl"></div>
                </div>
            )}
            
            <div className="flex justify-between items-center mb-6">
                <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider border flex items-center gap-2 ${planKey === 'lifetime' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/20' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700'}`}>
                    {planKey === 'lifetime' && <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>}
                    {phaseLabel || (planKey === 'lifetime' ? 'Limited Offer' : 'Subscription')}
                </span>
            </div>
            
            <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">{title}</h3>
            <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold text-zinc-900 dark:text-white">{price}{currency}</span>
                {planKey === 'monthly' && <span className="text-xs text-zinc-500 dark:text-zinc-600 ml-2">/ month</span>}
                {planKey === 'lifetime' && <span className="text-xs text-green-600 dark:text-green-400 font-medium ml-2 uppercase">ONE-TIME</span>}
            </div>

            <div className="space-y-4 mb-8">
                {features.map((f, i) => (
                    <div key={i} className="flex items-start gap-3">
                        <div className={`p-1 rounded-full mt-0.5 ${planKey === 'lifetime' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'}`}>
                            {i === 0 ? icon : <Check size={12} />}
                        </div>
                        <p className="text-sm text-zinc-800 dark:text-zinc-300 font-medium">{f}</p>
                    </div>
                ))}
            </div>

            <div className="mt-auto pt-4 border-t border-zinc-200 dark:border-zinc-800/50">
                {!userStatus.isOwned ? (
                    <button 
                        onClick={() => handleBuy(planKey as any)}
                        disabled={!!isBuying}
                        className={`w-full py-3.5 text-white rounded-xl font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] ${btnColor}`}
                    >
                        {isBuying === planKey ? <Loader2 size={16} className="animate-spin" /> : (planKey === 'lifetime' ? <CreditCard size={16} /> : <Calendar size={16} />)}
                        {isBuying === planKey ? 'Processing...' : (planKey === 'lifetime' ? 'Buy Lifetime' : 'Subscribe')}
                    </button>
                ) : (
                    <div className="w-full py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-default">
                        <Check size={16} /> {planKey === 'lifetime' ? 'You own this' : 'Active'}
                    </div>
                )}
            </div>
        </div>
      );
  };

  return (
    <div id="roadmap-block" className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto text-left">
        {/* Render Cards Dynamically */}
        {renderCard('monthly', config.plans.monthly, { isCurrent: isMonthlyUser, isOwned: isMonthlyUser || isLifetimeUser })}
        {renderCard('lifetime', config.plans.lifetime, { isCurrent: isLifetimeUser, isOwned: isLifetimeUser })}
        {renderCard('team', config.plans.team, { isCurrent: false, isOwned: false })}
    </div>
  );
};
