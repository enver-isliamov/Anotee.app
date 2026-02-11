
import React, { useState, useEffect } from 'react';
import { User, S3Config } from '../types';
import { Crown, Database, Check, AlertCircle, CreditCard, Calendar, XCircle, Shield, ArrowUpCircle, Settings, Heart, Zap, Loader2, HardDrive, Server, Globe, Key, Cloud, Info, CheckCircle2 } from 'lucide-react';
import { RoadmapBlock } from './RoadmapBlock';
import { useLanguage } from '../services/i18n';
import { useAuth, useUser } from '@clerk/clerk-react';
import { useSubscription } from '../hooks/useSubscription';
import { useDrive } from '../services/driveContext';

interface ProfileProps {
  currentUser: User;
  onLogout: () => void;
  onNavigate?: (page: string) => void;
}

const ADMIN_EMAILS = ['enverphoto@gmail.com', 'enver.isliamov@yandex.com'];

const S3_PRESETS: Record<string, Partial<S3Config>> = {
    yandex: {
        provider: 'yandex',
        endpoint: 'https://storage.yandexcloud.net',
        region: 'ru-central1',
    },
    selectel: {
        provider: 'selectel',
        endpoint: 'https://s3.storage.selcloud.ru',
        region: 'ru-1',
    },
    cloudflare: {
        provider: 'cloudflare',
        endpoint: 'https://<ACCOUNT_ID>.r2.cloudflarestorage.com',
        region: 'auto',
    },
    aws: {
        provider: 'aws',
        endpoint: '',
        region: 'us-east-1',
    }
};

export const Profile: React.FC<ProfileProps> = ({ currentUser, onNavigate }) => {
  const { t } = useLanguage();
  const { getToken } = useAuth();
  const { isPro, expiresAt, checkStatus } = useSubscription();
  const { user } = useUser();
  const { isDriveReady, checkDriveConnection } = useDrive();
  
  // States for S3
  const [activeStorageTab, setActiveStorageTab] = useState<'google' | 's3'>('google');
  const [s3Config, setS3Config] = useState<S3Config>({
      provider: 'yandex',
      bucket: '',
      region: 'ru-central1',
      endpoint: 'https://storage.yandexcloud.net',
      accessKeyId: '',
      secretAccessKey: ''
  });
  const [isSavingS3, setIsSavingS3] = useState(false);
  const [s3Saved, setS3Saved] = useState(false);
  const [isS3Loading, setIsS3Loading] = useState(true);

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

  // Load S3 Config on Mount
  useEffect(() => {
      const loadS3Config = async () => {
          try {
              const token = await getToken();
              const res = await fetch('/api/storage/config', {
                  headers: { 'Authorization': `Bearer ${token}` }
              });
              if (res.ok) {
                  const data = await res.json();
                  if (data) {
                      setS3Config({
                          provider: data.provider,
                          bucket: data.bucket,
                          endpoint: data.endpoint,
                          region: data.region,
                          accessKeyId: data.accessKeyId,
                          secretAccessKey: data.secretAccessKey, // Will be masked
                          publicUrl: data.publicUrl
                      });
                      setActiveStorageTab('s3'); // Auto switch if configured
                  }
              }
          } catch (e) {
              console.error("Failed to load S3 config", e);
          } finally {
              setIsS3Loading(false);
          }
      };
      loadS3Config();
  }, [getToken]);

  const handleS3PresetChange = (provider: string) => {
      const preset = S3_PRESETS[provider] || { provider: 'custom', endpoint: '', region: '' };
      setS3Config(prev => ({
          ...prev,
          ...preset,
          provider: provider as any
      }));
  };

  const handleSaveS3 = async () => {
      setIsSavingS3(true);
      try {
          const token = await getToken();
          const res = await fetch('/api/storage/config', {
              method: 'POST',
              headers: { 
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify(s3Config)
          });

          if (!res.ok) throw new Error("Failed to save");
          
          setS3Saved(true);
          setTimeout(() => setS3Saved(false), 3000);
      } catch (e) {
          alert("Ошибка сохранения настроек. Проверьте соединение.");
      } finally {
          setIsSavingS3(false);
      }
  };

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
                
                {/* COLUMN 1: STORAGE SETTINGS (NEW) */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Main Subscription Card */}
                    <div className={`bg-zinc-900 border rounded-3xl p-6 relative overflow-hidden shadow-2xl flex flex-col ${isPro ? 'border-indigo-500 ring-1 ring-indigo-500 shadow-indigo-500/10' : 'border-zinc-800'}`}>
                        {/* ... Subscription UI (Existing) ... */}
                        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                            <div className="w-64 h-64 bg-indigo-500 rounded-full blur-[100px]"></div>
                        </div>
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

                    {/* STORAGE CONFIGURATION (NEW) */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 relative">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-zinc-800 rounded-lg text-zinc-300">
                                <Database size={20} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">Хранилище Видео</h3>
                                <p className="text-xs text-zinc-500">Куда будут загружаться ваши новые файлы.</p>
                            </div>
                        </div>

                        {/* Toggle Tabs */}
                        <div className="flex bg-zinc-950 p-1 rounded-xl mb-6 border border-zinc-800">
                            <button 
                                onClick={() => setActiveStorageTab('google')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${activeStorageTab === 'google' ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                <HardDrive size={16} /> Google Drive
                            </button>
                            <button 
                                onClick={() => setActiveStorageTab('s3')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${activeStorageTab === 's3' ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                <Server size={16} /> S3 (Yandex/AWS)
                            </button>
                        </div>

                        {isS3Loading && activeStorageTab === 's3' ? (
                            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-zinc-500" /></div>
                        ) : (
                            <>
                                {activeStorageTab === 'google' ? (
                                    <div className="space-y-4 animate-in fade-in">
                                        <div className={`p-4 rounded-xl border flex items-start gap-3 ${isDriveReady ? 'bg-green-900/10 border-green-900/30' : 'bg-red-900/10 border-red-900/30'}`}>
                                            {isDriveReady ? <CheckCircle2 className="text-green-500 mt-0.5" /> : <AlertCircle className="text-red-500 mt-0.5" />}
                                            <div>
                                                <h4 className={`text-sm font-bold ${isDriveReady ? 'text-green-400' : 'text-red-400'}`}>
                                                    {isDriveReady ? 'Подключено и работает' : 'Требуется переподключение'}
                                                </h4>
                                                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                                                    Файлы хранятся на вашем личном Google Диске в папке <code>Anotee.App</code>. Это бесплатно и не занимает место на наших серверах.
                                                </p>
                                            </div>
                                        </div>
                                        <button onClick={checkDriveConnection} className="text-xs text-zinc-500 hover:text-white underline decoration-dashed">
                                            Проверить статус подключения
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-6 animate-in fade-in">
                                        <div className="p-4 bg-indigo-900/10 border border-indigo-500/20 rounded-xl text-xs text-indigo-300 flex gap-2">
                                            <Info size={16} className="shrink-0 mt-0.5" />
                                            <p>Вы можете подключить своё объектное хранилище (S3). Это обеспечит максимальную скорость воспроизведения и полный контроль над файлами.</p>
                                        </div>

                                        {/* Presets */}
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-2">Провайдер</label>
                                            <div className="flex gap-2 flex-wrap">
                                                {['yandex', 'selectel', 'cloudflare', 'custom'].map(p => (
                                                    <button 
                                                        key={p}
                                                        onClick={() => handleS3PresetChange(p)}
                                                        className={`px-3 py-1.5 rounded-lg border text-xs font-bold capitalize transition-all ${s3Config.provider === p ? 'bg-white text-black border-white' : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}
                                                    >
                                                        {p}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="col-span-2">
                                                <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1.5">Endpoint URL</label>
                                                <div className="relative">
                                                    <Globe size={14} className="absolute left-3 top-3 text-zinc-600" />
                                                    <input 
                                                        value={s3Config.endpoint} 
                                                        onChange={(e) => setS3Config(p => ({...p, endpoint: e.target.value}))}
                                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-2.5 text-sm text-zinc-200 focus:border-indigo-500 outline-none font-mono" 
                                                        placeholder="https://storage.yandexcloud.net"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1.5">Bucket Name</label>
                                                <div className="relative">
                                                    <Database size={14} className="absolute left-3 top-3 text-zinc-600" />
                                                    <input 
                                                        value={s3Config.bucket} 
                                                        onChange={(e) => setS3Config(p => ({...p, bucket: e.target.value}))}
                                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-2.5 text-sm text-zinc-200 focus:border-indigo-500 outline-none" 
                                                        placeholder="my-videos"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1.5">Region</label>
                                                <div className="relative">
                                                    <Cloud size={14} className="absolute left-3 top-3 text-zinc-600" />
                                                    <input 
                                                        value={s3Config.region} 
                                                        onChange={(e) => setS3Config(p => ({...p, region: e.target.value}))}
                                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-2.5 text-sm text-zinc-200 focus:border-indigo-500 outline-none" 
                                                        placeholder="ru-central1"
                                                    />
                                                </div>
                                            </div>
                                            <div className="col-span-2">
                                                <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1.5">Access Key ID</label>
                                                <div className="relative">
                                                    <Key size={14} className="absolute left-3 top-3 text-zinc-600" />
                                                    <input 
                                                        value={s3Config.accessKeyId} 
                                                        onChange={(e) => setS3Config(p => ({...p, accessKeyId: e.target.value}))}
                                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-2.5 text-sm text-zinc-200 focus:border-indigo-500 outline-none font-mono" 
                                                        placeholder="YCAJE..."
                                                    />
                                                </div>
                                            </div>
                                            <div className="col-span-2">
                                                <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1.5">Secret Access Key</label>
                                                <div className="relative">
                                                    <Key size={14} className="absolute left-3 top-3 text-zinc-600" />
                                                    <input 
                                                        type="password"
                                                        value={s3Config.secretAccessKey} 
                                                        onChange={(e) => setS3Config(p => ({...p, secretAccessKey: e.target.value}))}
                                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-2.5 text-sm text-zinc-200 focus:border-indigo-500 outline-none font-mono" 
                                                        placeholder="YCMA..."
                                                    />
                                                </div>
                                                <p className="text-[10px] text-zinc-500 mt-2">
                                                    Ваши ключи шифруются перед сохранением в базе данных. <a href="#" className="underline hover:text-white">Инструкция по настройке CORS</a>
                                                </p>
                                            </div>
                                        </div>

                                        <div className="pt-4 border-t border-zinc-800 flex justify-end">
                                            <button 
                                                onClick={handleSaveS3}
                                                disabled={isSavingS3}
                                                className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 disabled:opacity-50"
                                            >
                                                {isSavingS3 ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                                {s3Saved ? 'Сохранено' : 'Сохранить настройки'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* COLUMN 2: EXTRAS */}
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
