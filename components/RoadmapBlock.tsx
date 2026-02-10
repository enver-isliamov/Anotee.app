
import React, { useState, useEffect } from 'react';
import { Lock, Check, Zap, Infinity as InfinityIcon, Loader2, CreditCard, Calendar, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../services/i18n';
import { useAuth } from '@clerk/clerk-react';
import { useSubscription } from '../hooks/useSubscription';
import { PaymentConfig, DEFAULT_PAYMENT_CONFIG, PlanConfig } from '../types';

export const RoadmapBlock: React.FC = () => {
  const { t } = useLanguage();
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const { isPro, plan } = useSubscription();
  const [isBuying, setIsBuying] = useState<string | null>(null);
  const [config, setConfig] = useState<PaymentConfig>(DEFAULT_PAYMENT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
      const loadConfig = async () => {
          // If auth is not fully loaded yet, we can still fetch public config, 
          // but let's wait a tick to ensure we know if user is signed in or not for the token
          if (!isLoaded) return;

          try {
              // Try to get token if signed in, otherwise proceed without it
              const token = isSignedIn ? await getToken() : null;
              
              const headers: Record<string, string> = {};
              if (token) {
                  headers['Authorization'] = `Bearer ${token}`;
              }

              const res = await fetch('/api/admin?action=get_payment_config', {
                  headers: headers
              });

              if (res.ok) {
                  const data = await res.json();
                  // Helper to safely merge legacy string arrays to new structure if needed
                  const mergedPlans = { ...DEFAULT_PAYMENT_CONFIG.plans };
                  
                  if (data.plans) {
                      Object.keys(data.plans).forEach(key => {
                          const k = key as keyof typeof mergedPlans;
                          if (data.plans[k]) {
                              // If features come as strings (legacy), convert them
                              const rawFeatures = data.plans[k].features;
                              let features = rawFeatures;
                              if (Array.isArray(rawFeatures) && typeof rawFeatures[0] === 'string') {
                                  features = rawFeatures.map((f: string) => ({
                                      title: f,
                                      desc: '',
                                      isCore: false
                                  }));
                              }
                              
                              mergedPlans[k] = {
                                  ...DEFAULT_PAYMENT_CONFIG.plans[k],
                                  ...data.plans[k],
                                  features: features || DEFAULT_PAYMENT_CONFIG.plans[k].features
                              };
                          }
                      });
                  }

                  setConfig({ 
                      ...DEFAULT_PAYMENT_CONFIG, 
                      ...data,
                      planOrder: data.planOrder || DEFAULT_PAYMENT_CONFIG.planOrder,
                      plans: mergedPlans
                  });
              }
          } catch(e) {
              // ignore, keep defaults
              console.warn("Failed to load payment config", e);
          } finally {
              setIsLoading(false);
          }
      };
      loadConfig();
  }, [isSignedIn, getToken, isLoaded]);

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

  const renderCard = (
      planKey: string, 
      userStatus: { isCurrent: boolean, isOwned: boolean }
  ) => {
      const planData = config.plans[planKey as keyof typeof config.plans];
      if (!planData) return null;

      const { isActive, title, subtitle, price, currency, features, footerStatus, footerLimit } = planData;
      
      // Styling logic
      let borderColor = 'border-zinc-800';
      let btnColor = 'bg-zinc-800 hover:bg-zinc-700';
      let btnText = 'text-white';
      
      if (planKey === 'lifetime') {
          borderColor = userStatus.isCurrent ? 'border-green-500 ring-1 ring-green-500' : 'border-zinc-800 hover:border-green-500/50';
          btnColor = 'bg-[#4f46e5] hover:bg-[#4338ca] shadow-[0_0_20px_rgba(79,70,229,0.3)]'; // Indigo glow
      } else if (planKey === 'monthly') {
          borderColor = 'border-zinc-800';
          btnColor = 'bg-zinc-800 hover:bg-zinc-700';
      } else if (planKey === 'free') {
          borderColor = 'border-zinc-800';
      }

      const isLocked = !isActive;

      return (
        <div key={planKey} className={`relative bg-zinc-950 border rounded-3xl p-6 flex flex-col h-full transition-all duration-300 group ${borderColor} ${isLocked ? 'opacity-60 grayscale-[0.5]' : 'opacity-100'}`}>
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                    {userStatus.isCurrent && <div className="bg-green-500/20 text-green-400 p-1 rounded-full"><Check size={12}/></div>}
                    <h3 className="text-xl font-bold text-white">{title}</h3>
                </div>
                {subtitle && <p className="text-zinc-500 text-xs leading-relaxed min-h-[32px]">{subtitle}</p>}
            </div>

            {/* Features List */}
            <div className="space-y-5 mb-8 flex-1">
                {features.map((f, i) => (
                    <div key={i} className="flex gap-3">
                        <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${f.isCore ? 'bg-green-900/30 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}>
                            {f.isCore ? <Zap size={12} fill="currentColor"/> : <Check size={12} />}
                        </div>
                        <div>
                            <div className="text-sm font-bold text-zinc-200 flex items-center gap-2">
                                {f.title}
                                {f.isCore && <span className="text-[9px] bg-zinc-800 text-zinc-400 px-1.5 rounded border border-zinc-700 font-normal">CORE</span>}
                            </div>
                            <div className="text-xs text-zinc-500 mt-0.5 leading-snug">{f.desc}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Price & Action */}
            {!isLocked ? (
                <div className="mt-auto">
                    {userStatus.isOwned || planKey === 'free' ? (
                        <button disabled className={`w-full py-3.5 bg-zinc-900 text-zinc-400 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-default border border-zinc-800 ${planKey === 'free' && !userStatus.isCurrent ? 'opacity-50' : ''}`}>
                            {userStatus.isCurrent ? <CheckCircle2 size={16} className="text-green-500" /> : null} 
                            {planKey === 'lifetime' ? 'Куплено' : (userStatus.isCurrent ? 'Активно' : 'Доступно')}
                        </button>
                    ) : (
                        <button 
                            onClick={() => handleBuy(planKey as any)}
                            disabled={!!isBuying}
                            className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-transform active:scale-95 ${btnColor} ${btnText}`}
                        >
                            {isBuying === planKey ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                            {isBuying === planKey ? 'Обработка...' : `Купить за ${price}${currency}`}
                        </button>
                    )}
                </div>
            ) : (
                <div className="mt-auto">
                    <button disabled className="w-full py-3.5 bg-zinc-900 text-zinc-600 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-not-allowed border border-zinc-800">
                        <Lock size={16} /> Недоступно
                    </button>
                </div>
            )}

            {/* Footer */}
            <div className="mt-4 pt-4 border-t border-zinc-900 flex justify-between text-[10px] font-medium">
                <span className="text-zinc-600">Статус: <span className={isActive ? 'text-green-500' : 'text-zinc-500'}>{footerStatus || (isActive ? 'Открыто' : 'Закрыто')}</span></span>
                <span className="text-zinc-600">{footerLimit || ''}</span>
            </div>
        </div>
      );
  };

  if (isLoading) {
      return (
        <div id="roadmap-block" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 max-w-7xl mx-auto text-left">
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 h-[500px] flex flex-col animate-pulse">
                    <div className="h-8 w-1/2 bg-zinc-800 rounded mb-4"></div>
                    <div className="h-4 w-3/4 bg-zinc-800/50 rounded mb-8"></div>
                    <div className="space-y-4 flex-1">
                        <div className="h-4 w-full bg-zinc-800/30 rounded"></div>
                        <div className="h-4 w-5/6 bg-zinc-800/30 rounded"></div>
                        <div className="h-4 w-4/6 bg-zinc-800/30 rounded"></div>
                    </div>
                    <div className="h-12 w-full bg-zinc-800 rounded-xl mt-8"></div>
                </div>
            ))}
        </div>
      );
  }

  // Use config.planOrder to determine render order
  return (
    <div id="roadmap-block" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 max-w-7xl mx-auto text-left animate-in fade-in duration-500">
        {config.planOrder.map(planKey => {
            let status = { isCurrent: false, isOwned: false };
            if (planKey === 'free') status = { isCurrent: !isPro, isOwned: true };
            if (planKey === 'monthly') status = { isCurrent: isMonthlyUser, isOwned: isMonthlyUser || isLifetimeUser };
            if (planKey === 'lifetime') status = { isCurrent: isLifetimeUser, isOwned: isLifetimeUser };
            // Team default false
            return renderCard(planKey, status);
        })}
    </div>
  );
};
