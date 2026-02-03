
import React, { useState } from 'react';
import { User } from '../types';
import { Crown, Database, Check, AlertCircle, LogOut, CreditCard, Calendar, XCircle, Shield, ArrowUpCircle, Settings, ChevronRight } from 'lucide-react';
import { RoadmapBlock } from './RoadmapBlock';
import { useLanguage } from '../services/i18n';
import { UserProfile, useAuth, useUser } from '@clerk/clerk-react';
import { useSubscription } from '../hooks/useSubscription';

interface ProfileProps {
  currentUser: User;
  onLogout: () => void;
  onNavigate?: (page: string) => void;
}

// UPDATE: Added your yandex email here
const ADMIN_EMAILS = ['enverphoto@gmail.com', 'enver.isliamov@yandex.com'];

export const Profile: React.FC<ProfileProps> = ({ currentUser, onLogout, onNavigate }) => {
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
        <div className="max-w-4xl mx-auto space-y-6 py-4 md:py-8 animate-in fade-in duration-500 pb-24 px-2 md:px-0">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                 <div>
                     <h2 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                        {t('profile.title')}
                     </h2>
                     <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">Управление аккаунтом и биллингом.</p>
                 </div>
                 
                 <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                     {isAdmin && onNavigate && (
                         <button 
                            onClick={() => onNavigate('ADMIN')}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-black dark:bg-white text-white dark:text-black hover:opacity-90 rounded-xl text-sm font-bold transition-all shadow-md"
                         >
                            <Shield size={16} />
                            Admin
                         </button>
                     )}
                     <button 
                        onClick={onLogout}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 rounded-xl text-sm font-bold transition-colors"
                     >
                        <LogOut size={16} />
                        {t('logout')}
                     </button>
                 </div>
            </div>
            
            {/* SUBSCRIPTION MANAGEMENT CARD */}
            <div className={`relative overflow-hidden rounded-2xl md:rounded-3xl border transition-all ${isPro ? 'bg-gradient-to-br from-indigo-900 to-zinc-900 border-indigo-500/30 text-white' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'}`}>
                {isPro && <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none"><Crown size={180} /></div>}
                
                <div className="p-5 md:p-8 relative z-10">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <CreditCard size={18} className={isPro ? "text-indigo-300" : "text-indigo-600 dark:text-indigo-400"} />
                                <span className={`text-xs font-bold uppercase tracking-wider ${isPro ? "text-indigo-200" : "text-zinc-500"}`}>Подписка</span>
                            </div>
                            <h3 className={`text-xl md:text-2xl font-bold ${isPro ? "text-white" : "text-zinc-900 dark:text-white"}`}>
                                {isPro ? "Founder's Club (Pro)" : "Starter Plan (Free)"}
                            </h3>
                        </div>
                        
                        {isPro && (
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/20 border border-green-500/30 text-green-400 text-xs font-bold backdrop-blur-sm self-start md:self-center">
                                <Check size={14} /> Активна
                            </div>
                        )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                        {/* Left Column: Details */}
                        <div className={`space-y-3 p-4 rounded-xl ${isPro ? 'bg-white/5 border border-white/10' : 'bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800'}`}>
                            {isPro ? (
                                <>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-indigo-200">Доступ до:</span>
                                        <span className="font-mono font-bold">{expiresAt ? expiresAt.toLocaleDateString() : 'Бессрочно'}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-indigo-200">Автопродление:</span>
                                        <span className={`font-bold flex items-center gap-2 ${isAutoRenew ? 'text-green-400' : 'text-zinc-400'}`}>
                                            {isAutoRenew ? 'Включено' : 'Отключено'}
                                        </span>
                                    </div>
                                </>
                            ) : (
                                <div className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                    Вы используете бесплатный тариф. <br/>
                                    Лимит: 3 активных проекта. Экспорт отключен.
                                </div>
                            )}
                        </div>

                        {/* Right Column: Actions */}
                        <div className="flex flex-col justify-end">
                            {isPro ? (
                                isAutoRenew ? (
                                    <button 
                                        onClick={handleCancelSubscription} 
                                        disabled={isCanceling}
                                        className="w-full py-3 bg-white/10 hover:bg-white/20 border border-white/10 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 backdrop-blur-md"
                                    >
                                        {isCanceling ? 'Обработка...' : <><XCircle size={14} /> Отменить автопродление</>}
                                    </button>
                                ) : (
                                    <p className="text-xs text-indigo-300 italic text-center md:text-right">
                                        Списаний больше не будет.
                                    </p>
                                )
                            ) : (
                                <button 
                                    onClick={() => document.getElementById('roadmap-block')?.scrollIntoView({ behavior: 'smooth' })} 
                                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
                                >
                                    <ArrowUpCircle size={16} /> Обновиться до Pro
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Clerk User Profile - Adapted for Seamless Integration */}
            <div className="mt-8">
                {/* Hiding the header title inside styling to avoid duplication with our own header */}
                <UserProfile 
                    routing="hash"
                    appearance={{
                        elements: {
                            rootBox: "w-full",
                            card: "w-full shadow-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden",
                            navbar: "hidden md:flex border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900",
                            navbarButton: "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800",
                            activeNavbarButton: "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400",
                            headerTitle: "hidden", // Hide redundant "Profile" title
                            headerSubtitle: "hidden",
                            // Mobile adjustments
                            navbarMobileMenuRow: "hidden", // Hide mobile menu trigger if possible or style it
                            profileSectionTitleText: "text-zinc-900 dark:text-white font-bold text-lg mb-2 border-b border-zinc-100 dark:border-zinc-800 pb-2",
                            userPreviewMainIdentifier: "text-zinc-900 dark:text-white font-bold",
                            userPreviewSecondaryIdentifier: "text-zinc-500 dark:text-zinc-400",
                            socialButtonsBlockButton: "text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800",
                            formFieldLabel: "text-zinc-700 dark:text-zinc-300 font-bold text-xs uppercase tracking-wider",
                            formFieldInput: "bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white rounded-xl",
                            footer: "hidden" 
                        },
                        variables: {
                            colorPrimary: "#4f46e5", 
                            colorBackground: "transparent",
                            colorText: "inherit",
                            fontFamily: "inherit",
                            borderRadius: "0.75rem"
                        }
                    }}
                />
            </div>

            {/* Migration Tool */}
            {!hasMigrated && (
                <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 mt-6">
                    <div className="flex flex-col md:flex-row items-start gap-4">
                        <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400 shrink-0">
                            <Database size={24} />
                        </div>
                        <div className="flex-1 w-full">
                            <h3 className="font-bold text-zinc-900 dark:text-white mb-2 text-base">Восстановление старых проектов</h3>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4 leading-relaxed">
                                Если вы создавали проекты до обновления системы аккаунтов, запустите этот инструмент, чтобы привязать их к вашему текущему профилю.
                            </p>
                            
                            {migrationStatus === 'success' ? (
                                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm font-bold bg-green-50 dark:bg-green-900/20 px-4 py-3 rounded-xl border border-green-200 dark:border-green-800">
                                    <Check size={16} /> Оптимизация завершена ({migratedCount} проектов найдено)
                                </div>
                            ) : migrationStatus === 'error' ? (
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm font-bold bg-red-50 dark:bg-red-900/20 px-4 py-3 rounded-xl border border-red-200 dark:border-red-800">
                                        <AlertCircle size={16} /> Ошибка: {errorMessage || "Неизвестная ошибка"}
                                    </div>
                                    <button onClick={handleMigrate} className="text-xs text-indigo-500 hover:underline text-left mt-1 pl-1">Попробовать снова</button>
                                </div>
                            ) : (
                                <button 
                                    onClick={handleMigrate} 
                                    disabled={migrationStatus === 'loading'}
                                    className="w-full md:w-auto bg-zinc-900 dark:bg-zinc-800 text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-zinc-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-6 flex items-center gap-2">
                        <ArrowUpCircle className="text-indigo-500" />
                        {t('profile.tiers')}
                    </h3>
                    <RoadmapBlock />
                </div>
            )}
        </div>
  );
};
