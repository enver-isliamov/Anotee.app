
import React, { useState, useEffect } from 'react';
import { User, S3Config } from '../types';
import { Crown, Database, Check, AlertCircle, CreditCard, Calendar, XCircle, Shield, ArrowUpCircle, Settings, Heart, Zap, Loader2, HardDrive, Server, Globe, Key, Cloud, Info, CheckCircle2, RefreshCw, HelpCircle, X, ExternalLink, AlertTriangle, Link as LinkIcon, Wand2 } from 'lucide-react';
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

const CORS_CONFIG_JSON = `[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "HEAD", "POST", "DELETE"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag", "x-amz-meta-custom-header"]
  }
]`;

const PROVIDER_GUIDES: Record<string, { title: string, steps: string[], link: string, linkText: string, warning?: string }> = {
    yandex: {
        title: 'Yandex Object Storage',
        steps: [
            'Создайте Бакет в консоли Object Storage.',
            'Перейдите в раздел "Сервисные аккауты" (в меню слева).',
            'Создайте новый аккаунт и ВАЖНО: добавьте ему роль "storage.editor" (Редактор хранилища).',
            'Нажмите на созданный аккаунт -> "Создать новый ключ" -> "Создать статический ключ доступа".',
            'Скопируйте "Идентификатор ключа" (Access Key) и "Секретный ключ" (Secret Key).'
        ],
        link: 'https://console.cloud.yandex.ru/',
        linkText: 'Открыть консоль Yandex',
        warning: 'Если не выдать роль storage.editor, загрузка работать не будет!'
    },
    cloudflare: {
        title: 'Cloudflare R2',
        steps: [
            'Зайдите в R2 Overview. Справа в колонке "Account Details" скопируйте "Account ID".',
            'Ваш Endpoint: https://<AccountID>.r2.cloudflarestorage.com',
            'Там же справа нажмите ссылку "Manage R2 API Tokens".',
            'Нажмите "Create API token". Выберите шаблон: "Admin Read & Write".',
            'Нажмите "Create API Token" внизу. Скопируйте "Access Key ID" и "Secret Access Key" из появившегося окна.'
        ],
        link: 'https://dash.cloudflare.com/?to=/:account/r2',
        linkText: 'Открыть Cloudflare R2',
        warning: 'В поле Endpoint вставляйте ссылку БЕЗ имени бакета в конце.'
    },
    selectel: {
        title: 'Selectel Storage',
        steps: [
            'Создайте контейнер (бакет) в разделе "Облачное хранилище".',
            'Перейдите в раздел "Управление доступом" -> "Пользователи".',
            'Создайте пользователя с ролью "Администратор облачного хранилища".',
            'Имя пользователя — это Access Key. Пароль пользователя — это Secret Key.',
            'Endpoint всегда: https://s3.storage.selcloud.ru'
        ],
        link: 'https://my.selectel.ru/storage',
        linkText: 'Открыть Selectel'
    },
    aws: {
        title: 'AWS S3',
        steps: [
            'Откройте IAM Console -> Users -> Create User.',
            'При создании выберите "Attach policies directly" и найдите "AmazonS3FullAccess".',
            'После создания пользователя откройте вкладку "Security credentials".',
            'Нажмите "Create access key" -> выберите "Third-party service".',
            'Скопируйте ключи.'
        ],
        link: 'https://console.aws.amazon.com/iam',
        linkText: 'Открыть AWS Console'
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
      secretAccessKey: '',
      publicUrl: ''
  });
  const [isSavingS3, setIsSavingS3] = useState(false);
  const [s3Saved, setS3Saved] = useState(false);
  const [isS3Loading, setIsS3Loading] = useState(true);
  
  // Test & Auto-Config State
  const [isTestingS3, setIsTestingS3] = useState(false);
  const [isConfiguringCors, setIsConfiguringCors] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showCorsHelp, setShowCorsHelp] = useState(false);
  const [showProviderHelp, setShowProviderHelp] = useState(false);

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
              const res = await fetch('/api/storage?action=config', {
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
                          publicUrl: data.publicUrl || ''
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
      setTestResult(null);
  };

  const handleSaveS3 = async () => {
      setIsSavingS3(true);
      try {
          const token = await getToken();
          const res = await fetch('/api/storage?action=config', {
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

  const handleTestConnection = async () => {
      // First save to ensure backend has latest credentials (especially for secret key)
      await handleSaveS3();
      
      setIsTestingS3(true);
      setTestResult(null);
      
      try {
          const token = await getToken();
          const res = await fetch('/api/storage?action=test', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` }
          });
          
          const data = await res.json();
          
          if (res.ok && data.success) {
              setTestResult({ success: true, message: `Успешно! Доступ к бакету '${data.bucket}' есть.` });
          } else {
              setTestResult({ success: false, message: data.error || "Ошибка соединения" });
          }
      } catch (e: any) {
          setTestResult({ success: false, message: e.message || "Сбой сети" });
      } finally {
          setIsTestingS3(false);
      }
  };

  const handleAutoCors = async () => {
      // First save ensure backend has creds
      await handleSaveS3();
      
      setIsConfiguringCors(true);
      setTestResult(null);

      try {
          const token = await getToken();
          const res = await fetch('/api/storage?action=configure_cors', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` }
          });
          
          const data = await res.json();
          
          if (res.ok && data.success) {
              setTestResult({ success: true, message: "CORS успешно настроен! Загрузка должна работать." });
          } else {
              setTestResult({ success: false, message: data.error || "Не удалось настроить CORS." });
          }
      } catch (e) {
          setTestResult({ success: false, message: "Сбой сети при настройке CORS." });
      } finally {
          setIsConfiguringCors(false);
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

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      alert("Скопировано!");
  };

  // Check if migration has already run (via metadata)
  const hasMigrated = (currentUser as any).unsafeMetadata?.migrated === true;

  const currentProviderGuide = PROVIDER_GUIDES[s3Config.provider] || PROVIDER_GUIDES['aws'];

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
                        {/* ... Subscription UI ... */}
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
                                            
                                            {/* PUBLIC URL / CDN INPUT */}
                                            <div className="col-span-2">
                                                <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1.5 flex justify-between">
                                                    <span>Public URL / CDN (Optional)</span>
                                                    <span className="text-zinc-600 font-normal normal-case">For Custom Domains</span>
                                                </label>
                                                <div className="relative">
                                                    <LinkIcon size={14} className="absolute left-3 top-3 text-zinc-600" />
                                                    <input 
                                                        value={s3Config.publicUrl || ''} 
                                                        onChange={(e) => setS3Config(p => ({...p, publicUrl: e.target.value}))}
                                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-2.5 text-sm text-zinc-200 focus:border-indigo-500 outline-none font-mono" 
                                                        placeholder="https://cdn.mysite.com"
                                                    />
                                                </div>
                                                <p className="text-[10px] text-zinc-600 mt-1">
                                                    Если указано, плеер будет использовать этот домен вместо Endpoint. Полезно для Cloudflare.
                                                </p>
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
                                                <div className="flex justify-between items-center mt-2 gap-4">
                                                    <button onClick={() => setShowProviderHelp(true)} className="text-[10px] text-zinc-400 hover:text-white underline flex items-center gap-1 shrink-0">
                                                        <Key size={10} /> Где взять ключи?
                                                    </button>
                                                    <button onClick={() => setShowCorsHelp(true)} className="text-[10px] text-indigo-400 hover:text-indigo-300 underline flex items-center gap-1 shrink-0 ml-auto">
                                                        <HelpCircle size={10} /> Инструкция по CORS
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Status Message Area */}
                                        {testResult && (
                                            <div className={`p-3 rounded-lg text-xs font-bold border ${testResult.success ? 'bg-green-900/20 text-green-400 border-green-800' : 'bg-red-900/20 text-red-400 border-red-800'} flex items-center gap-2 animate-in fade-in slide-in-from-top-2`}>
                                                {testResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                                                {testResult.message}
                                            </div>
                                        )}

                                        <div className="pt-4 border-t border-zinc-800 flex justify-end gap-3 flex-wrap">
                                            {/* AUTO-CORS BUTTON */}
                                            <button 
                                                onClick={handleAutoCors}
                                                disabled={isConfiguringCors || isSavingS3}
                                                className="px-4 py-2.5 rounded-xl border border-indigo-500/30 hover:bg-indigo-900/20 text-indigo-300 text-sm font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
                                                title="Автоматически настроить CORS в облаке"
                                            >
                                                {isConfiguringCors ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                                                Авто-CORS
                                            </button>

                                            <button 
                                                onClick={handleTestConnection}
                                                disabled={isSavingS3 || isTestingS3}
                                                className="px-4 py-2.5 rounded-xl border border-zinc-700 hover:bg-zinc-800 text-zinc-300 text-sm font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
                                            >
                                                {isTestingS3 ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                                                Проверить
                                            </button>
                                            <button 
                                                onClick={handleSaveS3}
                                                disabled={isSavingS3 || isTestingS3}
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

            {/* PROVIDER HELP MODAL */}
            {showProviderHelp && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
                        <button onClick={() => setShowProviderHelp(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-900 dark:hover:text-white"><X size={20} /></button>
                        <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">{currentProviderGuide.title}</h2>
                        <p className="text-xs text-zinc-500 mb-4">Инструкция по получению ключей доступа</p>
                        
                        {currentProviderGuide.warning && (
                            <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 rounded-xl flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
                                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                                <p className="font-medium">{currentProviderGuide.warning}</p>
                            </div>
                        )}

                        <div className="space-y-3 mb-6">
                            {currentProviderGuide.steps.map((step, idx) => (
                                <div key={idx} className="flex gap-3 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                                    <div className="w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[10px] font-bold shrink-0 text-zinc-500 border border-zinc-200 dark:border-zinc-700">{idx + 1}</div>
                                    <p>{step}</p>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-between items-center pt-4 border-t border-zinc-200 dark:border-zinc-800">
                            <a 
                                href={currentProviderGuide.link} 
                                target="_blank" 
                                rel="noreferrer"
                                className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:underline text-xs font-bold"
                            >
                                {currentProviderGuide.linkText} <ExternalLink size={12} />
                            </a>
                            <button onClick={() => setShowProviderHelp(false)} className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg text-xs font-bold hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors text-zinc-700 dark:text-zinc-300">Закрыть</button>
                        </div>
                    </div>
                </div>
            )}

            {/* CORS HELP MODAL */}
            {showCorsHelp && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
                        <button onClick={() => setShowCorsHelp(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-900 dark:hover:text-white"><X size={20} /></button>
                        <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">Настройка CORS</h2>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">Для того чтобы браузер мог загружать файлы в ваше хранилище и воспроизводить их, необходимо добавить эту конфигурацию в настройки вашего Bucket.</p>
                        
                        <div className="bg-zinc-100 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 font-mono text-[10px] text-zinc-600 dark:text-zinc-400 overflow-auto max-h-64 relative group">
                            <pre>{CORS_CONFIG_JSON}</pre>
                            <button 
                                onClick={() => copyToClipboard(CORS_CONFIG_JSON)}
                                className="absolute top-2 right-2 p-2 bg-white dark:bg-zinc-800 rounded-lg shadow-sm text-zinc-500 hover:text-black dark:hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <RefreshCw size={14} />
                            </button>
                        </div>
                        
                        <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
                            <button onClick={() => setShowCorsHelp(false)} className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg text-xs font-bold hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors text-zinc-700 dark:text-zinc-300">Понятно</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
  );
};
