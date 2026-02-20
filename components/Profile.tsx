
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, S3Config } from '../types';
import { Crown, Database, Check, AlertCircle, Shield, ArrowUpCircle, Heart, Zap, Loader2, HardDrive, Server, Globe, Key, Cloud, CheckCircle2, RefreshCw, HelpCircle, X, ExternalLink, AlertTriangle, Wand2, Edit2, LayoutTemplate, LogOut, Power, Settings, Eye, EyeOff, Lock, Unlock } from 'lucide-react';
import { RoadmapBlock } from './RoadmapBlock';
import { useLanguage } from '../services/i18n';
import { useAuth, useUser } from '@clerk/clerk-react';
import { useSubscription } from '../hooks/useSubscription';
import { useDrive } from '../services/driveContext';
import { useAppConfig } from '../hooks/useAppConfig';
import { isFeatureEnabled } from '../services/entitlements';
import { getPlanLabel, getPlanBadgeClass } from '../services/planLabels';

interface ProfileProps {
  currentUser: User;
  onLogout: () => void;
  onNavigate?: (page: string) => void;
}

// Added 'google' to generic type for UI handling
type ExtendedProvider = S3Config['provider'] | 'google';

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
    },
    google: {
        provider: 'custom', 
        endpoint: '',
        region: ''
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
            '1. Зайдите в R2 Overview. Справа "Account Details" -> Скопируйте "Account ID".',
            '2. Ваш Endpoint должен выглядеть так: https://<AccountID>.r2.cloudflarestorage.com (БЕЗ имени бакета!).',
            '3. Справа нажмите "Manage R2 API Tokens" -> "Create API token".',
            '4. Permissions: выберите "Admin Read & Write".',
            '5. Нажмите "Create". Скопируйте "Access Key ID" и "Secret Access Key".'
        ],
        link: 'https://dash.cloudflare.com/?to=/:account/r2',
        linkText: 'Открыть Cloudflare R2',
        warning: 'В поле Endpoint вставляйте URL аккаунта, а не бакета. Бакет указывается отдельно.'
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

export const Profile: React.FC<ProfileProps> = ({ currentUser, onNavigate, onLogout }) => {
  const DONATE_URL = 'https://pay.cloudtips.ru/p/71defd27';
  const { t } = useLanguage();
  const { getToken } = useAuth();
  const { plan, expiresAt, checkStatus, isPro, isLifetime } = useSubscription();
  const { user } = useUser();
  const { isDriveReady, checkDriveConnection } = useDrive();
  const { config } = useAppConfig();
  
  // 1. ACTIVE STATE (What is currently live on server)
  const [activeProvider, setActiveProvider] = useState<ExtendedProvider>('google');
  
  // 2. UI STATE (What tab is selected for viewing/editing)
  const [selectedTab, setSelectedTab] = useState<ExtendedProvider>('google');
  
  // 3. FORM STATE (Draft data for the selected tab)
  const [s3Form, setS3Form] = useState<S3Config>({
      provider: 'yandex',
      bucket: '',
      region: 'ru-central1',
      endpoint: 'https://storage.yandexcloud.net',
      accessKeyId: '',
      secretAccessKey: '',
      publicUrl: ''
  });

  // 4. CACHE (Remember inputs when switching tabs)
  const [inputCache, setInputCache] = useState<Record<string, S3Config>>({});

  const [isSavingS3, setIsSavingS3] = useState(false);
  const [s3Saved, setS3Saved] = useState(false);
  const [isS3Loading, setIsS3Loading] = useState(true);
  
  // Sensitive Data Visibility Toggles
  const [showAccessKey, setShowAccessKey] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  
  // Lock States for Inputs
  const [editingFields, setEditingFields] = useState({
      endpoint: false,
      bucket: false,
      region: false,
      accessKey: false
  });
  
  const [isTestingS3, setIsTestingS3] = useState(false);
  const [isConfiguringCors, setIsConfiguringCors] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  
  // Helpers
  const [showCorsHelp, setShowCorsHelp] = useState(false);
  const [showProviderHelp, setShowProviderHelp] = useState(false);
  const [showCnameHelp, setShowCnameHelp] = useState(false);

  const [migrationStatus, setMigrationStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [migratedCount, setMigratedCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  
  const [isCanceling, setIsCanceling] = useState(false);
  const [isDonating, setIsDonating] = useState(false);

  const isAutoRenew = !!(user?.publicMetadata as any)?.yookassaPaymentMethodId;
  const role = (user?.publicMetadata as any)?.role;
  const isAdmin = role === 'admin' || role === 'superadmin';
  const canUseWhiteLabel = isFeatureEnabled(config, 's3_custom_domain', plan);

  const toggleEdit = (field: keyof typeof editingFields) => {
      setEditingFields(prev => ({ ...prev, [field]: !prev[field] }));
  };

  // Load Config
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
                      const loadedConfig = {
                          provider: data.provider,
                          bucket: data.bucket,
                          endpoint: data.endpoint,
                          region: data.region,
                          accessKeyId: data.accessKeyId,
                          secretAccessKey: data.secretAccessKey,
                          publicUrl: data.publicUrl || ''
                      };
                      
                      // Set Active Provider
                      if (data.provider && data.endpoint) {
                          setActiveProvider(data.provider);
                          setSelectedTab(data.provider);
                          setS3Form(loadedConfig);
                          // Initialize cache for active provider
                          setInputCache(prev => ({ ...prev, [data.provider]: loadedConfig }));
                      } else {
                          setActiveProvider('google');
                          setSelectedTab('google');
                      }
                  } else {
                      setActiveProvider('google');
                      setSelectedTab('google');
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

  // Tab Switching Logic with Caching
  const handleTabSwitch = (newTab: ExtendedProvider) => {
      // 1. Save current work to cache
      if (selectedTab !== 'google') {
          setInputCache(prev => ({ ...prev, [selectedTab]: s3Form }));
      }

      setSelectedTab(newTab);
      setTestResult(null);
      setEditingFields({ endpoint: false, bucket: false, region: false, accessKey: false });
      setShowAccessKey(false);
      setShowSecretKey(false);

      if (newTab !== 'google') {
          // 2. Try to restore from cache
          if (inputCache[newTab]) {
              setS3Form(inputCache[newTab]);
          } 
          // 3. Or load Active Config if it matches this tab (fresh load from server basically)
          else if (activeProvider === newTab && activeProvider !== 'custom') {
              // We already loaded active config into s3Form on mount, so if we haven't cached edits, 
              // we might want to revert to server state? Or keep current s3Form?
              // The initial load sets s3Form. If we switched away and back without editing, inputCache handles it.
              // If we switch to a tab we haven't visited yet:
              
              // Load preset defaults
              const preset = S3_PRESETS[newTab] || S3_PRESETS['custom'];
              setS3Form({
                  provider: newTab as any,
                  bucket: '',
                  region: preset.region || '',
                  endpoint: preset.endpoint || '',
                  accessKeyId: '',
                  secretAccessKey: '', // Reset secret for security when starting fresh on new tab
                  publicUrl: ''
              });
          }
          // 4. Default Preset
          else {
              const preset = S3_PRESETS[newTab] || S3_PRESETS['custom'];
              setS3Form({
                  provider: newTab as any,
                  bucket: '',
                  region: preset.region || '',
                  endpoint: preset.endpoint || '',
                  accessKeyId: '',
                  secretAccessKey: '',
                  publicUrl: ''
              });
          }
      }
  };

  const handleSaveAndActivate = async () => {
      if (selectedTab === 'google') {
          alert("Для активации Google Drive убедитесь, что он подключен (кнопка выше). Настройки S3 не будут использоваться.");
          setActiveProvider('google'); 
          return;
      }

      setIsSavingS3(true);
      try {
          const token = await getToken();
          const res = await fetch('/api/storage?action=config', {
              method: 'POST',
              headers: { 
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify(s3Form)
          });

          if (!res.ok) throw new Error("Failed to save");
          
          setS3Saved(true);
          // Update active provider state
          setActiveProvider(selectedTab);
          
          // Update cache with confirmed saved data
          setInputCache(prev => ({ ...prev, [selectedTab]: s3Form }));
          
          setTimeout(() => setS3Saved(false), 3000);
      } catch (e) {
          alert("Ошибка сохранения настроек. Проверьте соединение.");
      } finally {
          setIsSavingS3(false);
      }
  };

  const handleTestConnection = async () => {
      await handleSaveAndActivate(); 
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
      await handleSaveAndActivate(); 
      setIsConfiguringCors(true);
      setTestResult(null);
      try {
          const token = await getToken();
          const res = await fetch('/api/storage?action=configure_cors', {
              method: 'POST',
              headers: { 
                  'Authorization': `Bearer ${token}`, 
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify({}) 
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

  // ... (Legacy handlers: migrate, cancel, donate, copy) ...
  const handleMigrate = async () => {
      setMigrationStatus('loading');
      setErrorMessage('');
      try {
          const token = await getToken();
          const res = await fetch('/api/admin?action=migrate', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.details || data.error || "Migration failed");
          setMigratedCount(data.updatedProjects || 0);
          setMigrationStatus('success');
      } catch (e: any) {
          setErrorMessage(e.message);
          setMigrationStatus('error');
      }
  };

  const handleCancelSubscription = async () => {
      if (!confirm("Вы действительно хотите отключить автопродление?")) return;
      setIsCanceling(true);
      try {
          const token = await getToken();
          const res = await fetch('/api/payment?action=cancel_sub', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) { await checkStatus(); alert("Автопродление отключено."); } 
          else { alert("Не удалось отключить."); }
      } catch (e) { alert("Ошибка сети"); } finally { setIsCanceling(false); }
  };

  const handleDonate = () => {
      setIsDonating(true);
      window.location.href = DONATE_URL;
  };

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      alert("Скопировано!");
  };

  const hasMigrated = (currentUser as any).unsafeMetadata?.migrated === true;
  const currentProviderGuide = PROVIDER_GUIDES[s3Form.provider] || PROVIDER_GUIDES['aws'];

  const ProviderCard = ({ id, label, icon, color }: { id: ExtendedProvider, label: string, icon: any, color: string }) => {
      const isActive = activeProvider === id;
      const isSelected = selectedTab === id;
      return (
          <button
              onClick={() => handleTabSwitch(id)}
              className={`relative p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 group w-full h-[90px] justify-center
                  ${isSelected ? `border-indigo-500 bg-zinc-800 shadow-lg scale-[1.02] z-10` : 'border-zinc-800 bg-zinc-950 hover:border-zinc-700 opacity-80 hover:opacity-100'}
              `}
          >
              {isActive && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded-full">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-[9px] font-bold text-green-500 uppercase tracking-wide">Active</span>
                  </div>
              )}
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold shadow-lg ${color} ${!isSelected ? 'opacity-70 group-hover:opacity-100' : ''}`}>
                  {icon}
              </div>
              <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-zinc-500 group-hover:text-zinc-300'}`}>
                  {label}
              </span>
          </button>
      );
  };

  const LockedInput = ({ 
      label, value, onChange, placeholder, icon, isEditing, onToggleEdit, type = "text", showToggle = false, onShowToggle 
  }: any) => {
      return (
          <div>
              <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1.5">{label}</label>
              <div className="relative group">
                  <div className="absolute left-3 top-3 text-zinc-600">{icon}</div>
                  <input 
                      type={type}
                      value={value} 
                      readOnly={!isEditing}
                      onChange={onChange}
                      className={`w-full bg-zinc-900 border rounded-lg pl-9 pr-10 py-2.5 text-sm text-zinc-200 outline-none font-mono transition-colors placeholder-zinc-700 ${isEditing ? 'border-indigo-500 focus:bg-black' : 'border-zinc-800 cursor-default opacity-80'}`}
                      placeholder={placeholder}
                  />
                  <div className="absolute right-2 top-2 flex gap-1">
                      {showToggle && (
                          <button onClick={onShowToggle} className="p-1 rounded hover:bg-zinc-800 text-zinc-600 hover:text-white transition-colors">
                              {type === "text" ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                      )}
                      <button 
                          onClick={onToggleEdit} 
                          className={`p-1 rounded hover:bg-zinc-800 transition-colors ${isEditing ? 'text-indigo-400' : 'text-zinc-600 hover:text-white'}`}
                          title={isEditing ? "Lock Editing" : "Edit Field"}
                      >
                          {isEditing ? <Check size={14} /> : <Edit2 size={14} />}
                      </button>
                  </div>
              </div>
          </div>
      );
  };

  // New visual logic using helper
  const planLabel = getPlanLabel(plan);
  const planBadgeClass = getPlanBadgeClass(plan);

  return (
        <div className="w-full mx-auto space-y-8 py-8 animate-in fade-in duration-500 pb-24 px-4 md:px-0">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                 <div>
                     <h2 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
                        {t('profile.title')}
                     </h2>
                     <p className="text-zinc-400 text-sm mt-1">Управление подпиской и хранилищем.</p>
                 </div>
                 <div className="flex items-center gap-2">
                     {isAdmin && onNavigate && (
                         <button onClick={() => onNavigate('ADMIN')} className="flex items-center justify-center gap-2 px-4 py-2 bg-white text-black hover:opacity-90 rounded-xl text-sm font-bold transition-all shadow-md">
                            <Shield size={16} /> Admin
                         </button>
                     )}
                     <button onClick={onLogout} className="flex items-center justify-center gap-2 px-4 py-2 bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 rounded-xl text-sm font-bold transition-all">
                        <LogOut size={16} /> {t('logout')}
                     </button>
                 </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* COLUMN 1: SETTINGS */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Subscription */}
                    <div className={`bg-zinc-900 border rounded-3xl p-6 relative overflow-hidden shadow-2xl flex flex-col justify-between min-h-[140px] ${isPro || isLifetime ? 'border-indigo-500 ring-1 ring-indigo-500 shadow-indigo-500/10' : 'border-zinc-800'}`}>
                        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none"><div className="w-64 h-64 bg-indigo-500 rounded-full blur-[100px]"></div></div>
                        <div>
                            <div className="flex justify-between items-center mb-2 relative z-10">
                                <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider border flex items-center gap-2 ${planBadgeClass}`}>
                                    {planLabel}
                                </span>
                                {plan === 'pro' && isAutoRenew && <button onClick={handleCancelSubscription} className="text-[10px] text-zinc-500 hover:text-red-400 underline">{isCanceling ? '...' : 'Отменить подписку'}</button>}
                            </div>
                            <h3 className="text-xl font-bold text-white">
                                {isLifetime ? "Пожизненный доступ" : (isPro ? "Подписка активна" : "Базовый тариф")}
                            </h3>
                            {isPro && expiresAt && <p className="text-xs text-zinc-500 mt-1">Истекает: {expiresAt.toLocaleDateString()}</p>}
                            {isLifetime && <p className="text-xs text-zinc-500 mt-1">Лимиты: {config.max_projects.limitLifetime || '∞'} проектов</p>}
                        </div>
                        {plan === 'free' && <button onClick={() => document.getElementById('roadmap-block')?.scrollIntoView({ behavior: 'smooth' })} className="mt-4 w-full py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-2"><ArrowUpCircle size={14} /> Обновиться</button>}
                    </div>

                    {/* STORAGE CONFIGURATION */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 relative">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-zinc-800 rounded-lg text-zinc-300"><Database size={20} /></div>
                            <div>
                                <h3 className="text-lg font-bold text-white">Провайдер Хранилища</h3>
                                <p className="text-xs text-zinc-500">Выберите, куда загружать исходники видео.</p>
                            </div>
                        </div>

                        {isS3Loading ? (
                            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-zinc-500" /></div>
                        ) : (
                            <div className="space-y-6 animate-in fade-in">
                                
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                    <ProviderCard id="google" label="Google" icon={<HardDrive size={16} />} color="bg-green-600" />
                                    <ProviderCard id="yandex" label="Yandex" icon="Y" color="bg-red-500" />
                                    <ProviderCard id="cloudflare" label="R2" icon="C" color="bg-orange-500" />
                                    <ProviderCard id="selectel" label="Selectel" icon="S" color="bg-blue-500" />
                                    <ProviderCard id="custom" label="Custom" icon="?" color="bg-zinc-600" />
                                </div>

                                <div className="bg-zinc-950/50 p-5 rounded-xl border border-zinc-800/50 min-h-[220px] animate-in fade-in slide-in-from-top-1 duration-200">
                                    
                                    {selectedTab === 'google' && (
                                        <div className="flex flex-col items-center justify-center h-full py-4 text-center space-y-4">
                                            <div className={`p-3 rounded-full ${isDriveReady ? 'bg-green-900/20 text-green-500' : 'bg-red-900/20 text-red-500'}`}>
                                                <HardDrive size={24} />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-white text-base">Google Drive Integration</h3>
                                                <p className="text-xs text-zinc-500 max-w-xs mx-auto mt-1">
                                                    Храните файлы на личном диске. Бесплатно и безопасно. 
                                                    {activeProvider !== 'google' && " (Сейчас не активно)"}
                                                </p>
                                            </div>
                                            
                                            <button 
                                                onClick={checkDriveConnection}
                                                className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all border ${isDriveReady ? 'border-green-800 bg-green-900/10 text-green-400' : 'border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-white'}`}
                                            >
                                                {isDriveReady ? 'Подключено' : 'Подключить Google Drive'}
                                            </button>

                                            {activeProvider !== 'google' && isDriveReady && (
                                                <button onClick={handleSaveAndActivate} className="text-xs text-indigo-400 hover:text-white underline">
                                                    Сделать основным хранилищем
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {selectedTab !== 'google' && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            
                                            <div className="col-span-2 flex justify-between items-center border-b border-zinc-800 pb-2 mb-2">
                                                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                                    {selectedTab === 'cloudflare' ? <Zap size={12} className="text-orange-500"/> : <Settings size={12}/>}
                                                    Настройка {S3_PRESETS[selectedTab]?.provider || 'Custom'}
                                                </h4>
                                                <button onClick={() => setShowProviderHelp(true)} className="text-[10px] text-indigo-400 hover:text-white flex items-center gap-1 transition-colors">
                                                    <HelpCircle size={10} /> Инструкция по получению ключей
                                                </button>
                                            </div>

                                            {/* ENDPOINT */}
                                            <div className="col-span-2">
                                                <LockedInput 
                                                    label="Endpoint URL"
                                                    value={s3Form.endpoint}
                                                    onChange={(e: any) => setS3Form(p => ({...p, endpoint: e.target.value}))}
                                                    isEditing={editingFields.endpoint}
                                                    onToggleEdit={() => toggleEdit('endpoint')}
                                                    icon={<Globe size={14} />}
                                                    placeholder="https://storage.yandexcloud.net"
                                                />
                                                {selectedTab === 'cloudflare' && (
                                                    <p className="text-[9px] text-zinc-500 mt-1 pl-2">
                                                        Пример: <code>https://&lt;ACCOUNT_ID&gt;.r2.cloudflarestorage.com</code> (без бакета!)
                                                    </p>
                                                )}
                                            </div>
                                            
                                            {/* BUCKET */}
                                            <div>
                                                <LockedInput 
                                                    label="Bucket Name"
                                                    value={s3Form.bucket}
                                                    onChange={(e: any) => setS3Form(p => ({...p, bucket: e.target.value}))}
                                                    isEditing={editingFields.bucket}
                                                    onToggleEdit={() => toggleEdit('bucket')}
                                                    icon={<Database size={14} />}
                                                    placeholder="my-bucket"
                                                />
                                            </div>
                                            
                                            {/* REGION */}
                                            <div>
                                                <LockedInput 
                                                    label="Region"
                                                    value={s3Form.region}
                                                    onChange={(e: any) => setS3Form(p => ({...p, region: e.target.value}))}
                                                    isEditing={editingFields.region}
                                                    onToggleEdit={() => toggleEdit('region')}
                                                    icon={<Cloud size={14} />}
                                                    placeholder="us-east-1"
                                                />
                                            </div>
                                            
                                            {/* ACCESS KEY */}
                                            <div className="col-span-2">
                                                <LockedInput 
                                                    label="Access Key ID"
                                                    value={s3Form.accessKeyId}
                                                    onChange={(e: any) => setS3Form(p => ({...p, accessKeyId: e.target.value}))}
                                                    isEditing={editingFields.accessKey}
                                                    onToggleEdit={() => toggleEdit('accessKey')}
                                                    icon={<Key size={14} />}
                                                    placeholder="ACCESS_KEY"
                                                    type={showAccessKey ? "text" : "password"}
                                                    showToggle={true}
                                                    onShowToggle={() => setShowAccessKey(!showAccessKey)}
                                                />
                                            </div>

                                            {/* Secret Key (Smart UI - Keep existing logic as it's distinct) */}
                                            <div className="col-span-2">
                                                <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1.5">Secret Access Key</label>
                                                <div className="relative group">
                                                    <Key size={14} className="absolute left-3 top-3 text-zinc-600" />
                                                    
                                                    {s3Form.secretAccessKey === '********' ? (
                                                        // SAVED STATE
                                                        <div className="flex items-center">
                                                            <input 
                                                                type="password"
                                                                disabled
                                                                value="........................"
                                                                className="w-full bg-zinc-900/50 border border-green-900/30 rounded-lg pl-9 pr-20 py-2.5 text-sm text-green-500 font-mono cursor-not-allowed opacity-70"
                                                            />
                                                            <div className="absolute right-2 top-2 flex items-center gap-2">
                                                                <span className="text-[10px] text-green-600 font-bold uppercase bg-green-900/20 px-1.5 py-0.5 rounded border border-green-900/50">Saved</span>
                                                                <button 
                                                                    onClick={() => setS3Form(p => ({...p, secretAccessKey: ''}))}
                                                                    className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                                                                    title="Change Secret Key"
                                                                >
                                                                    <Edit2 size={12} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        // EDITING STATE
                                                        <>
                                                            <input 
                                                                type={showSecretKey ? "text" : "password"}
                                                                value={s3Form.secretAccessKey} 
                                                                onChange={(e) => setS3Form(p => ({...p, secretAccessKey: e.target.value}))}
                                                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-10 py-2.5 text-sm text-zinc-200 focus:border-indigo-500 outline-none font-mono placeholder-zinc-700" 
                                                                placeholder="Enter New Secret Key"
                                                            />
                                                            <button onClick={() => setShowSecretKey(!showSecretKey)} className="absolute right-3 top-2.5 text-zinc-600 hover:text-white">
                                                                {showSecretKey ? <EyeOff size={14} /> : <Eye size={14} />} 
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Status Area */}
                                            {testResult && (
                                                <div className={`col-span-2 p-3 rounded-lg text-xs font-bold border ${testResult.success ? 'bg-green-900/20 text-green-400 border-green-800' : 'bg-red-900/20 text-red-400 border-red-800'} flex items-center gap-2 animate-in fade-in slide-in-from-top-2`}>
                                                    {testResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                                                    {testResult.message}
                                                </div>
                                            )}

                                            {/* Action Buttons */}
                                            <div className="col-span-2 pt-4 border-t border-zinc-800 flex justify-between gap-3 flex-wrap items-center">
                                                <div className="flex gap-3">
                                                    <button onClick={() => setShowCorsHelp(true)} className="text-[10px] text-zinc-500 hover:text-zinc-300 underline">CORS Config</button>
                                                    <button onClick={handleAutoCors} disabled={isConfiguringCors} className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"><Wand2 size={10}/> Auto-Fix CORS</button>
                                                </div>

                                                <div className="flex gap-2">
                                                    <button 
                                                        onClick={handleTestConnection}
                                                        disabled={isSavingS3 || isTestingS3}
                                                        className="px-4 py-2 rounded-xl border border-zinc-700 hover:bg-zinc-800 text-zinc-300 text-xs font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
                                                    >
                                                        {isTestingS3 ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Проверить
                                                    </button>
                                                    <button 
                                                        onClick={handleSaveAndActivate}
                                                        disabled={isSavingS3 || isTestingS3}
                                                        className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95 ${
                                                            activeProvider === selectedTab 
                                                                ? 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700' 
                                                                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20'
                                                        }`}
                                                    >
                                                        {isSavingS3 ? <Loader2 size={14} className="animate-spin" /> : (activeProvider === selectedTab ? <Check size={14} /> : <Power size={14} />)}
                                                        {activeProvider === selectedTab ? 'Сохранить изменения' : `Активировать ${S3_PRESETS[selectedTab]?.provider || 'S3'}`}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* WHITE LABEL / CDN BLOCK */}
                    {selectedTab !== 'google' && canUseWhiteLabel && (
                        <div className="relative group overflow-hidden rounded-3xl p-[1px] bg-gradient-to-br from-violet-500/50 via-fuchsia-500/50 to-indigo-500/50 shadow-2xl">
                            <div className="absolute inset-0 bg-gradient-to-br from-violet-500 via-fuchsia-500 to-indigo-500 opacity-10 blur-xl group-hover:opacity-20 transition-opacity duration-500"></div>
                            
                            <div className="relative bg-zinc-950 rounded-[23px] p-6 h-full overflow-hidden">
                                <div className="absolute top-0 right-0 p-4">
                                    <Crown size={120} className="text-violet-500/5 rotate-12" />
                                </div>

                                <div className="flex items-start justify-between mb-6 relative z-10">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-gradient-to-br from-violet-500 to-fuchsia-600 rounded-xl text-white shadow-lg shadow-violet-500/20">
                                            <LayoutTemplate size={24} />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                                White Label CDN
                                            </h3>
                                            <p className="text-xs text-violet-200/70">Ваш личный домен для раздачи контента</p>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-bold bg-violet-500/10 text-violet-300 px-2 py-1 rounded border border-violet-500/20 uppercase tracking-widest">
                                        Premium
                                    </span>
                                </div>

                                <div className="grid md:grid-cols-2 gap-6 mb-6">
                                    <div className="space-y-4">
                                        <div className="relative">
                                            <label className="text-[10px] font-bold text-zinc-500 uppercase mb-2 block">Ваш Домен (CDN)</label>
                                            <div className="relative">
                                                <Globe size={16} className="absolute left-3 top-3.5 text-violet-400" />
                                                <input 
                                                    value={s3Form.publicUrl || ''} 
                                                    onChange={(e) => setS3Form(p => ({...p, publicUrl: e.target.value}))}
                                                    className="w-full bg-zinc-900/50 border border-violet-500/30 rounded-xl pl-10 pr-3 py-3 text-sm text-white focus:border-violet-500 outline-none font-mono placeholder-zinc-600 transition-colors shadow-inner" 
                                                    placeholder="https://cdn.mysite.com"
                                                />
                                            </div>
                                        </div>
                                        
                                        <button 
                                            onClick={() => setShowCnameHelp(true)}
                                            className="text-xs text-violet-400 hover:text-white flex items-center gap-1.5 transition-colors group/link"
                                        >
                                            <HelpCircle size={14} className="group-hover/link:scale-110 transition-transform" />
                                            Как настроить CNAME запись?
                                        </button>
                                    </div>

                                    <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 flex flex-col justify-center">
                                        <div className="text-[10px] text-zinc-500 mb-2 uppercase font-bold text-center">Как видят клиенты</div>
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-xs text-green-400 font-bold bg-green-900/10 px-2 py-1 rounded border border-green-500/20">
                                                <CheckCircle2 size={12} />
                                                {s3Form.publicUrl ? s3Form.publicUrl.replace('https://', '') : 'cdn.yourbrand.com'}/video.mp4
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                {activeProvider === selectedTab && (
                                    <div className="flex justify-end pt-4 border-t border-white/5">
                                        <button 
                                            onClick={handleSaveAndActivate}
                                            disabled={isSavingS3}
                                            className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-violet-900/30 active:scale-95"
                                        >
                                            Сохранить настройки бренда
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
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

                    {/* Migration Tool */}
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

            {!isPro && !isLifetime && (
                <div className="mt-12">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        <ArrowUpCircle className="text-indigo-500" />
                        {t('profile.tiers')}
                    </h3>
                    <RoadmapBlock />
                </div>
            )}

            {/* HELP MODALS (Unchanged logic, just ensure render) */}
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
                            <a href={currentProviderGuide.link} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:underline text-xs font-bold">
                                {currentProviderGuide.linkText} <ExternalLink size={12} />
                            </a>
                            <button onClick={() => setShowProviderHelp(false)} className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg text-xs font-bold hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors text-zinc-700 dark:text-zinc-300">Закрыть</button>
                        </div>
                    </div>
                </div>
            )}

            {showCorsHelp && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
                        <button onClick={() => setShowCorsHelp(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-900 dark:hover:text-white"><X size={20} /></button>
                        <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">Настройка CORS</h2>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">Для работы браузера с вашим хранилищем.</p>
                        <div className="bg-zinc-100 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 font-mono text-[10px] text-zinc-600 dark:text-zinc-400 overflow-auto max-h-64 relative group">
                            <pre>{CORS_CONFIG_JSON}</pre>
                            <button onClick={() => copyToClipboard(CORS_CONFIG_JSON)} className="absolute top-2 right-2 p-2 bg-white dark:bg-zinc-800 rounded-lg shadow-sm text-zinc-500 hover:text-black dark:hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"><RefreshCw size={14} /></button>
                        </div>
                        <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
                            <button onClick={() => setShowCorsHelp(false)} className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg text-xs font-bold hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors text-zinc-700 dark:text-zinc-300">Понятно</button>
                        </div>
                    </div>
                </div>
            )}

            {showCnameHelp && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
                        <button onClick={() => setShowCnameHelp(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-900 dark:hover:text-white"><X size={20} /></button>
                        <div className="flex items-center gap-3 mb-4"><div className="p-2 bg-violet-100 dark:bg-violet-900/20 rounded-lg text-violet-600 dark:text-violet-400"><Globe size={24} /></div><div><h2 className="text-lg font-bold text-zinc-900 dark:text-white">Настройка своего домена</h2><p className="text-xs text-zinc-500">Как подключить красивые ссылки</p></div></div>
                        <div className="space-y-4 mb-6">
                            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 p-3 rounded-xl flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400"><AlertTriangle size={16} className="shrink-0 mt-0.5" /><p className="font-bold">ВАЖНО: Имя вашего бакета (Bucket Name) должно в точности совпадать с именем домена.</p></div>
                            <div className="space-y-3">
                                <div className="flex gap-3 text-sm text-zinc-700 dark:text-zinc-300"><div className="w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[10px] font-bold shrink-0 text-zinc-500 border border-zinc-200 dark:border-zinc-700">1</div><div><p className="font-bold mb-1">Создайте бакет</p><p className="text-xs text-zinc-500">Назовите его, например: <code>cdn.mysite.com</code></p></div></div>
                                <div className="flex gap-3 text-sm text-zinc-700 dark:text-zinc-300"><div className="w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[10px] font-bold shrink-0 text-zinc-500 border border-zinc-200 dark:border-zinc-700">2</div><div><p className="font-bold mb-1">Настройте DNS (CNAME)</p><p className="text-xs text-zinc-500">У регистратора домена добавьте запись:</p><div className="mt-1 bg-zinc-100 dark:bg-zinc-950 p-2 rounded border border-zinc-200 dark:border-zinc-800 font-mono text-[10px]">TYPE: CNAME<br/>NAME: cdn<br/>VALUE: {s3Form.provider === 'yandex' ? 'website.yandexcloud.net' : 'custom.domain.r2.dev'}</div></div></div>
                            </div>
                        </div>
                        <div className="flex justify-end pt-4 border-t border-zinc-200 dark:border-zinc-800">
                            <button onClick={() => setShowCnameHelp(false)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors">Всё понятно</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
  );
};
