
import React, { useState } from 'react';
import { User } from '../types';
import { Crown, Database, Check, AlertCircle, LogOut, CreditCard, Calendar, XCircle, Shield } from 'lucide-react';
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
      if (!confirm("Вы уверены, что хотите отключить автопродление? Доступ сохранится до конца оплаченного периода.")) return;
      
      setIsCanceling(true);
      try {
          const token = await getToken();
          const res = await fetch('/api/payment?action=cancel_sub', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (res.ok) {
              await checkStatus(); // Reload user data
              alert("Автопродление отключено.");
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
        <div className="max-w-5xl mx-auto space-y-8 py-8 animate-in fade-in duration-500 pb-24">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                 <div>
                     <h2 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                        {t('profile.title')}
                     </h2>
                     <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">Управление аккаунтом и подписками.</p>
                 </div>
                 
                 <div className="flex items-center gap-2">
                     {isAdmin && onNavigate && (
                         <button 
                            onClick={() => onNavigate('ADMIN')}
                            className="flex items-center gap-2 px-4 py-2 bg-black dark:bg-white text-white dark:text-black hover:opacity-90 rounded-lg text-sm font-bold transition-all shadow-lg"
                         >
                            <Shield size={16} />
                            Admin Dashboard
                         </button>
                     )}
                     <button 
                        onClick={onLogout}
                        className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-sm font-bold transition-colors border border-red-200 dark:border-red-900/50"
                     >
                        <LogOut size={16} />
                        {t('logout')}
                     </button>
                 </div>
            </div>
            
            {/* SUBSCRIPTION MANAGEMENT CARD (Visible only for PRO) */}
            {isPro && (
                <div className="bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-900/50 rounded-2xl p-6 shadow-lg shadow-indigo-500/5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Crown size={120} className="text-indigo-500" /></div>
                    
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2 relative z-10">
                        <Crown size={20} className="text-indigo-500" /> Ваша подписка
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-600 dark:text-indigo-400"><CreditCard size={20} /></div>
                                <div>
                                    <div className="text-xs text-zinc-500 uppercase font-bold">Текущий план</div>
                                    <div className="text-sm font-bold text-zinc-900 dark:text-white">Founder's Club (Pro)</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-400"><Calendar size={20} /></div>
                                <div>
                                    <div className="text-xs text-zinc-500 uppercase font-bold">Активна до</div>
                                    <div className="text-sm font-bold text-zinc-900 dark:text-white">{expiresAt ? expiresAt.toLocaleDateString() : 'Бессрочно'}</div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-zinc-50 dark:bg-zinc-950/50 rounded-xl p-4 border border-zinc-200 dark:border-zinc-800">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <div className="text-xs font-bold text-zinc-500 uppercase mb-1">Автопродление</div>
                                    <div className={`text-sm font-bold flex items-center gap-2 ${isAutoRenew ? 'text-green-600' : 'text-zinc-500'}`}>
                                        <div className={`w-2 h-2 rounded-full ${isAutoRenew ? 'bg-green-500 animate-pulse' : 'bg-zinc-400'}`}></div>
                                        {isAutoRenew ? 'Включено' : 'Отключено'}
                                    </div>
                                </div>
                            </div>
                            
                            {isAutoRenew ? (
                                <button 
                                    onClick={handleCancelSubscription} 
                                    disabled={isCanceling}
                                    className="w-full py-2 bg-white dark:bg-zinc-800 border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2"
                                >
                                    {isCanceling ? 'Обработка...' : <><XCircle size={14} /> Отменить автопродление</>}
                                </button>
                            ) : (
                                <p className="text-xs text-zinc-400 italic">
                                    Доступ сохранится до {expiresAt?.toLocaleDateString()}. Списаний больше не будет.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Clerk User Profile - Full Mode */}
            <div className="flex justify-center">
                <UserProfile 
                    routing="hash"
                    appearance={{
                        elements: {
                            rootBox: "w-full shadow-none",
                            card: "w-full shadow-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden",
                            navbar: "border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900",
                            navbarButton: "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800",
                            activeNavbarButton: "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400",
                            headerTitle: "text-zinc-900 dark:text-white",
                            headerSubtitle: "text-zinc-500 dark:text-zinc-400",
                            profileSectionTitleText: "text-zinc-900 dark:text-white font-bold",
                            userPreviewMainIdentifier: "text-zinc-900 dark:text-white font-bold",
                            userPreviewSecondaryIdentifier: "text-zinc-500 dark:text-zinc-400",
                            socialButtonsBlockButton: "text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800",
                            formFieldLabel: "text-zinc-700 dark:text-zinc-300",
                            formFieldInput: "bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white",
                            footer: "hidden" 
                        },
                        variables: {
                            colorPrimary: "#4f46e5", 
                            colorBackground: "transparent",
                            colorText: "inherit",
                        }
                    }}
                />
            </div>

            {/* Migration Tool */}
            {!hasMigrated && (
                <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
                    <div className="flex items-start gap-4">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                            <Database size={24} />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-zinc-900 dark:text-white mb-1">Восстановление старых проектов</h3>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                                Если вы создавали проекты до обновления, запустите этот инструмент, чтобы привязать их к новому аккаунту.
                            </p>
                            
                            {migrationStatus === 'success' ? (
                                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm font-bold bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg border border-green-200 dark:border-green-800">
                                    <Check size={16} /> Оптимизация завершена ({migratedCount} проектов найдено)
                                </div>
                            ) : migrationStatus === 'error' ? (
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm font-bold bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg border border-red-200 dark:border-red-800">
                                        <AlertCircle size={16} /> Ошибка: {errorMessage || "Неизвестная ошибка"}
                                    </div>
                                    <button onClick={handleMigrate} className="text-xs text-indigo-500 hover:underline text-left mt-1">Попробовать снова</button>
                                </div>
                            ) : (
                                <button 
                                    onClick={handleMigrate} 
                                    disabled={migrationStatus === 'loading'}
                                    className="bg-zinc-900 dark:bg-zinc-800 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-zinc-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    {migrationStatus === 'loading' ? 'Обработка...' : 'Запустить поиск проектов'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {!isPro && (
                <div>
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-4 px-1 mt-8">{t('profile.tiers')}</h3>
                    <RoadmapBlock />
                </div>
            )}
        </div>
  );
};
