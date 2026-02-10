
import React, { useState } from 'react';
import { User } from '../types';
import { Crown, Database, Check, AlertCircle, CreditCard, Calendar, XCircle, Shield, ArrowUpCircle, Settings, Heart, Zap, Loader2 } from 'lucide-react';
import { RoadmapBlock } from './RoadmapBlock';
import { useLanguage } from '../services/i18n';
import { useAuth, useUser } from '@clerk/clerk-react';
import { useSubscription } from '../hooks/useSubscription';

interface ProfileProps {
  currentUser: User;
  onLogout: () => void;
  onNavigate?: (page: string) => void;
}

const ADMIN_EMAILS = ['enverphoto@gmail.com', 'enver.isliamov@yandex.com'];

export const Profile: React.FC<ProfileProps> = ({ currentUser, onNavigate }) => {
  const { t } = useLanguage();
  const { getToken } = useAuth();
  const { isPro, expiresAt, checkStatus } = useSubscription();
  const { user } = useUser();
  
  const [migrationStatus, setMigrationStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [migratedCount, setMigratedCount] = useState(0);
  
  const [isCanceling, setIsCanceling] = useState(false);
  const [isDonating, setIsDonating] = useState(false);

  // Check if auto-renew is active (payment method saved)
  const isAutoRenew = !!(user?.publicMetadata as any)?.yookassaPaymentMethodId;

  // Check Admin Access
  const primaryEmail = user?.primaryEmailAddress?.emailAddress;
  const isAdmin = primaryEmail && ADMIN_EMAILS.includes(primaryEmail);

  const handleMigrate = async () => {
      setMigrationStatus('loading');
      setErrorMessage('');
      try {
          const token = await getToken();
          const res = await fetch('/api/admin?action=migrate', {
              method: 'POST',
              headers: {
                  'Authorization': `Bearer ${token}`
              }
          });

          const data = await res.json();

          if (!res.ok) {
              throw new Error(data.details || data.error || "Migration failed");
          }
          
          setMigratedCount(data.updatedProjects || 0);
          setMigrationStatus('success');
      } catch (e: any) {
          console.error(e);
          setErrorMessage(e.message);
          setMigrationStatus('error');
      }
  };

  const handleCancelSubscription = async () => {
      if (!confirm("Вы действительно хотите отключить автопродление? Вы сохраните доступ до конца оплаченного периода.")) return;
      
      setIsCanceling(true);
      try {
          const token = await getToken();
          const res = await fetch('/api/payment?action=cancel_sub', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (res.ok) {
              await checkStatus(); // Reload user data
              alert("Автопродление успешно отключено.");
          } else {
              alert("Не удалось отключить. Попробуйте позже.");
          }
      } catch (e) {
          console.error(e);
          alert("Ошибка сети");
      } finally {
          setIsCanceling(false);
      }
  };

  const handleDonate = async () => {
      setIsDonating(true);
      try {
          const token = await getToken();
          const res = await fetch('/api/payment?action=init', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          if (res.ok && data.confirmationUrl) {
              window.location.href = data.confirmationUrl;
          } else {
              alert("Ошибка инициализации платежа");
          }
      } catch (e) {
          alert("Network error");
      } finally {
          setIsDonating(false);
      }
  };

  // Check if migration has already run (via metadata)
  const hasMigrated = (currentUser as any).unsafeMetadata?.migrated === true;

  const activeFeatures = isPro ? [
      "Безлимит проектов (Личные)",
      "Экспорт маркеров в DaVinci/Premiere",
      "Приоритетная поддержка",
      "Доступ к бета-функциям (AI)",
      "4K Video Proxies"
  ] : [
      "До 3-х активных проектов",
      "Комментарии и просмотр",
      "Базовая поддержка",
      "720p Video Proxies"
  ];

  return (
        <div className="w-full mx-auto space-y-8 py-8 animate-in fade-in duration-500 pb-24 px-4 md:px-0">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                 <div>
                     <h2 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
                        {t('profile.title')}
                     </h2>
                     <p className="text-zinc-400 text-sm mt-1">Управление подпиской и статусом аккаунта.</p>
                 </div>
                 
                 {isAdmin && onNavigate && (
                     <button 
                        onClick={() => onNavigate('ADMIN')}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-white text-black hover:opacity-90 rounded-xl text-sm font-bold transition-all shadow-md"
                     >
                        <Shield size={16} />
                        Admin Dashboard
                     </button>
                 )}
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* SUBSCRIPTION CARD */}
                <div className={`lg:col-span-2 bg-zinc-900 border rounded-3xl p-6 relative overflow-hidden shadow-2xl flex flex-col ${isPro ? 'border-indigo-500 ring-1 ring-indigo-500 shadow-indigo-500/10' : 'border-zinc-800'}`}>
                    {/* Background Glow */}
                    <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                        <div className="w-64 h-64 bg-indigo-500 rounded-full blur-[100px]"></div>
                    </div>
                    {isPro && (
                        <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl z-20 shadow-lg">
                            CURRENT PLAN
                        </div>
                    )}

                    <div className="flex justify-between items-center mb-6 relative z-10">
                        <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider border flex items-center gap-2 ${isPro ? 'bg-indigo-900/30 text-indigo-400 border-indigo-500/30' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
                            {isPro ? <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse"></div> : <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full"></div>}
                            {isPro ? "Founder's Club (Pro)" : "Starter (Free)"}
                        </span>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-end gap-2 mb-6 relative z-10">
                        <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                            {isPro ? "Ваша подписка активна" : "Бесплатный тариф"}
                        </h3>
                        {isPro && expiresAt && (
                            <div className="flex items-center gap-2 mb-1 ml-2">
                                <span className="text-xs text-zinc-500">истекает:</span>
                                <span className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400 border border-zinc-700 font-mono tracking-tight shadow-sm">
                                    {expiresAt.toLocaleDateString()}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Feature List */}
                    <div className="space-y-3 mb-8 relative z-10 bg-black/20 p-4 rounded-xl border border-white/5">
                        <p className="text-[10px] uppercase font-bold text-zinc-500 mb-2">Доступные функции:</p>
                        {activeFeatures.map((feat, idx) => (
                            <div key={idx} className="flex items-center gap-3">
                                <div className={`p-1 rounded-full mt-0.5 ${isPro ? 'bg-green-900/30 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}>
                                    <Check size={10} />
                                </div>
                                <span className={`text-sm ${isPro ? 'text-zinc-200' : 'text-zinc-400'}`}>{feat}</span>
                            </div>
                        ))}
                    </div>

                    {/* Action Area */}
                    <div className="mt-auto pt-4 border-t border-zinc-800 relative z-10">
                        {isPro ? (
                            <div className="flex flex-col gap-3">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-zinc-400">Автопродление</span>
                                    <span className={isAutoRenew ? "text-green-400 font-bold" : "text-zinc-500"}>
                                        {isAutoRenew ? "Включено" : "Отключено"}
                                    </span>
                                </div>
                                {isAutoRenew && (
                                    <button 
                                        onClick={handleCancelSubscription} 
                                        disabled={isCanceling}
                                        className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-bold transition-colors border border-red-500/20 flex items-center justify-center gap-2"
                                    >
                                        {isCanceling ? 'Обработка...' : 'Отменить автопродление'}
                                    </button>
                                )}
                                {!isAutoRenew && (
                                    <p className="text-[10px] text-zinc-500 text-center">
                                        Доступ сохранится до конца периода. Списаний больше не будет.
                                    </p>
                                )}
                            </div>
                        ) : (
                            <button 
                                onClick={() => document.getElementById('roadmap-block')?.scrollIntoView({ behavior: 'smooth' })} 
                                className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
                            >
                                <ArrowUpCircle size={16} /> Обновиться до Pro
                            </button>
                        )}
                    </div>
                </div>

                {/* DONATION & EXTRA CARD */}
                <div className="space-y-6">
                    {/* Support Block */}
                    <div className="bg-gradient-to-br from-pink-500/10 to-purple-500/10 border border-pink-500/20 rounded-3xl p-6 relative overflow-hidden">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-pink-500/20 rounded-lg text-pink-400">
                                <Heart size={20} fill="currentColor" />
                            </div>
                            <h3 className="font-bold text-white text-sm">Поддержать проект</h3>
                        </div>
                        <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
                            Мы развиваем Anotee как независимую платформу. Ваш вклад помогает нам оплачивать серверы и ускорять разработку новых фич.
                        </p>
                        <button 
                            onClick={handleDonate}
                            disabled={isDonating}
                            className="w-full py-3 bg-pink-600 hover:bg-pink-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-pink-900/20 flex items-center justify-center gap-2 transition-all"
                        >
                            {isDonating ? <Loader2 size={16} className="animate-spin"/> : <Heart size={16} />}
                            Задонатить
                        </button>
                    </div>

                    {/* Migration Tool (Only if needed) */}
                    {!hasMigrated && (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
                            <div className="flex items-center gap-3 mb-3">
                                <Database size={18} className="text-indigo-400" />
                                <h3 className="font-bold text-zinc-300 text-sm">Восстановление данных</h3>
                            </div>
                            <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
                                Если у вас были проекты до обновления аккаунтов, нажмите кнопку ниже, чтобы привязать их.
                            </p>
                            
                            {migrationStatus === 'success' ? (
                                <div className="text-green-400 text-xs font-bold bg-green-900/20 px-3 py-2 rounded border border-green-800">
                                    Найдено: {migratedCount}
                                </div>
                            ) : (
                                <button 
                                    onClick={handleMigrate} 
                                    disabled={migrationStatus === 'loading'}
                                    className="w-full bg-zinc-800 text-zinc-300 px-4 py-2 rounded-lg text-xs font-bold hover:bg-zinc-700 transition-colors"
                                >
                                    {migrationStatus === 'loading' ? 'Поиск...' : 'Найти старые проекты'}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {!isPro && (
                <div className="mt-12">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        <ArrowUpCircle className="text-indigo-500" />
                        {t('profile.tiers')}
                    </h3>
                    <RoadmapBlock />
                </div>
            )}
        </div>
  );
};
