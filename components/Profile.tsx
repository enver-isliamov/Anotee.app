
import React, { useState } from 'react';
import { User } from '../types';
import { Crown, Database, Check, AlertCircle, CreditCard, Calendar, XCircle, Shield, ArrowUpCircle, Settings, Infinity as InfinityIcon, Zap } from 'lucide-react';
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

  // Check if migration has already run (via metadata)
  const hasMigrated = (currentUser as any).unsafeMetadata?.migrated === true;

  return (
        <div className="max-w-3xl mx-auto space-y-8 py-8 animate-in fade-in duration-500 pb-24 px-4 md:px-0">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                 <div>
                     <h2 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
                        {t('profile.title')}
                     </h2>
                     <p className="text-zinc-400 text-sm mt-1">Управление подпиской и восстановление данных.</p>
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
            
            {/* NEW STYLED SUBSCRIPTION CARD (Roadmap Style) */}
            <div className={`bg-zinc-900 border rounded-3xl p-6 relative overflow-hidden shadow-2xl flex flex-col ${isPro ? 'border-indigo-500 ring-1 ring-indigo-500 shadow-indigo-500/10' : 'border-zinc-800'}`}>
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
                        <span className="text-sm text-zinc-400 mb-1 ml-1">
                            до {expiresAt.toLocaleDateString()}
                        </span>
                    )}
                </div>

                {/* Feature List within Card */}
                <div className="space-y-4 mb-8 relative z-10 bg-black/20 p-4 rounded-xl border border-white/5">
                    {isPro ? (
                        <>
                            <div className="flex items-start gap-3">
                                <div className="p-1 rounded-full bg-green-900/30 text-green-400 mt-0.5"><Check size={12} /></div>
                                <div>
                                    <p className="text-sm text-zinc-200 font-medium">{t('rm.unlimited')}</p>
                                    <p className="text-xs text-zinc-500 mt-0.5">Создавайте сколько угодно проектов</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="p-1 rounded-full bg-green-900/30 text-green-400 mt-0.5"><Zap size={12} /></div>
                                <div>
                                    <p className="text-sm text-zinc-200 font-medium">DaVinci / Premiere Export</p>
                                    <p className="text-xs text-zinc-500 mt-0.5">Экспорт маркеров в монтажные программы</p>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex items-start gap-3">
                            <div className="p-1 rounded-full bg-zinc-800 text-zinc-500 mt-0.5"><Check size={12} /></div>
                            <div>
                                <p className="text-sm text-zinc-300 font-medium">Базовый доступ</p>
                                <p className="text-xs text-zinc-500 mt-0.5">Лимит: 3 активных проекта. Без экспорта.</p>
                            </div>
                        </div>
                    )}
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

            {/* Migration Tool */}
            {!hasMigrated && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                    <div className="flex flex-col md:flex-row items-start gap-4">
                        <div className="p-3 bg-indigo-900/30 rounded-xl text-indigo-400 shrink-0">
                            <Database size={24} />
                        </div>
                        <div className="flex-1 w-full">
                            <h3 className="font-bold text-white mb-2 text-base">Восстановление старых проектов</h3>
                            <p className="text-sm text-zinc-400 mb-4 leading-relaxed">
                                Если вы создавали проекты до обновления системы аккаунтов, запустите этот инструмент, чтобы привязать их к вашему текущему профилю.
                            </p>
                            
                            {migrationStatus === 'success' ? (
                                <div className="flex items-center gap-2 text-green-400 text-sm font-bold bg-green-900/20 px-4 py-3 rounded-xl border border-green-800">
                                    <Check size={16} /> Оптимизация завершена ({migratedCount} проектов найдено)
                                </div>
                            ) : migrationStatus === 'error' ? (
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center gap-2 text-red-400 text-sm font-bold bg-red-900/20 px-4 py-3 rounded-xl border border-red-800">
                                        <AlertCircle size={16} /> Ошибка: {errorMessage || "Неизвестная ошибка"}
                                    </div>
                                    <button onClick={handleMigrate} className="text-xs text-indigo-400 hover:underline text-left mt-1 pl-1">Попробовать снова</button>
                                </div>
                            ) : (
                                <button 
                                    onClick={handleMigrate} 
                                    disabled={migrationStatus === 'loading'}
                                    className="w-full md:w-auto bg-zinc-800 text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-zinc-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {migrationStatus === 'loading' ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"/> : 'Запустить поиск проектов'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

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
