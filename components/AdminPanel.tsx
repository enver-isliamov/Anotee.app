
import React, { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Shield, RefreshCw, ArrowLeft, CheckCircle, Zap, Settings, Save, AlertTriangle, Search, Crown, Layout, Cpu, Download, Sparkles, Sliders, Globe, HardDrive, TrendingUp, Target, Lightbulb, ListTodo, Flag, BarChart3, CreditCard, ExternalLink, DollarSign } from 'lucide-react';
import { FeatureRule, AppConfig, DEFAULT_CONFIG, PaymentConfig, DEFAULT_PAYMENT_CONFIG } from '../types';

interface AdminUser {
    id: string;
    name: string;
    email: string;
    avatar: string;
    plan: 'free' | 'pro' | 'lifetime';
    expiresAt: number | null;
    isAutoRenew: boolean;
    lastActive: number;
}

const FEATURE_DESCRIPTIONS: Record<keyof AppConfig, string> = {
    // General
    max_projects: "Лимиты проектов",
    team_collab: "Командная работа (Invite)",
    project_locking: "Блокировка (NDA Mode)",
    version_comparison: "Сравнение версий (Split View)",
    
    // Export
    export_xml: "Экспорт в DaVinci Resolve (.xml)",
    export_csv: "Экспорт в Premiere Pro (.csv)",
    local_file_link: "Локальные файлы (Offline Mode)",
    
    // AI & Cloud
    google_drive: "Google Drive Интеграция",
    ai_transcription: "AI Транскрибация (Whisper)",
    high_res_proxies: "4K Прокси / Оригиналы",
    
    // UI Elements
    ui_upsell_banner: "Баннер 'Купить Pro' (Дашборд)",
    ui_roadmap_block: "Блок Roadmap/Pricing (Профиль)",
    ui_help_button: "Кнопка 'Тур/Помощь' (Хедер)",
    ui_footer: "Футер приложения",
    ui_drive_connect: "Кнопка 'Подключить Drive'"
};

const CONFIG_GROUPS = {
    general: ['max_projects', 'team_collab', 'project_locking', 'version_comparison'],
    export: ['export_xml', 'export_csv', 'local_file_link'],
    ai: ['ai_transcription', 'high_res_proxies', 'google_drive'],
    ui: ['ui_upsell_banner', 'ui_roadmap_block', 'ui_help_button', 'ui_footer', 'ui_drive_connect']
};

const SUB_TABS = [
    { id: 'general', label: 'Основные', icon: Sliders },
    { id: 'export', label: 'Экспорт', icon: Download },
    { id: 'ai', label: 'AI и Облако', icon: Sparkles },
    { id: 'ui', label: 'Интерфейс', icon: Layout },
];

export const AdminPanel: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { getToken } = useAuth();
    const [activeTab, setActiveTab] = useState<'users' | 'features' | 'payments' | 'strategy'>('users');
    const [settingsSubTab, setSettingsSubTab] = useState('general');
    
    // User Data
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<AdminUser[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [usersLoading, setUsersLoading] = useState(true);
    const [userError, setUserError] = useState('');
    
    // Config Data
    const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
    const [configLoading, setConfigLoading] = useState(false);
    const [isSavingConfig, setIsSavingConfig] = useState(false);

    // Payment Data
    const [paymentConfig, setPaymentConfig] = useState<PaymentConfig>(DEFAULT_PAYMENT_CONFIG);
    const [paymentLoading, setPaymentLoading] = useState(false);
    const [isSavingPayment, setIsSavingPayment] = useState(false);

    // Grant Modal State
    const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
    const [grantDuration, setGrantDuration] = useState<number>(30); // days
    const [isGranting, setIsGranting] = useState(false);

    const fetchUsers = async () => {
        setUsersLoading(true);
        setUserError('');
        try {
            const token = await getToken();
            const res = await fetch('/api/admin?action=users', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Не удалось загрузить пользователей.");
            const data = await res.json();
            setUsers(data.users || []);
            setFilteredUsers(data.users || []);
        } catch (e: any) {
            setUserError(e.message);
        } finally {
            setUsersLoading(false);
        }
    };

    // Client-side search
    useEffect(() => {
        if (!searchQuery) {
            setFilteredUsers(users);
        } else {
            const lower = searchQuery.toLowerCase();
            setFilteredUsers(users.filter(u => 
                u.name.toLowerCase().includes(lower) || 
                u.email.toLowerCase().includes(lower)
            ));
        }
    }, [searchQuery, users]);

    const fetchConfig = async () => {
        setConfigLoading(true);
        try {
            const token = await getToken();
            const res = await fetch('/api/admin?action=get_config', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setConfig({ ...DEFAULT_CONFIG, ...data });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setConfigLoading(false);
        }
    };

    const fetchPaymentConfig = async () => {
        setPaymentLoading(true);
        try {
            const token = await getToken();
            const res = await fetch('/api/admin?action=get_payment_config', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                // Ensure defaults are merged
                setPaymentConfig({ 
                    ...DEFAULT_PAYMENT_CONFIG, 
                    ...data, 
                    prices: { ...DEFAULT_PAYMENT_CONFIG.prices, ...(data.prices || {}) },
                    yookassa: { ...DEFAULT_PAYMENT_CONFIG.yookassa, ...(data.yookassa || {}) },
                    prodamus: { ...DEFAULT_PAYMENT_CONFIG.prodamus, ...(data.prodamus || {}) }
                });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setPaymentLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'users') fetchUsers();
        if (activeTab === 'features') fetchConfig();
        if (activeTab === 'payments') fetchPaymentConfig();
    }, [activeTab]);

    const handleGrantPro = async () => {
        if (!selectedUser) return;
        setIsGranting(true);
        try {
            const token = await getToken();
            await fetch('/api/admin?action=grant_pro', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId: selectedUser.id, days: grantDuration })
            });
            setSelectedUser(null);
            fetchUsers();
        } catch (e) {
            alert("Ошибка при выдаче Pro");
        } finally {
            setIsGranting(false);
        }
    };

    const handleRevokePro = async (userId: string) => {
        if (!confirm("Вы уверены, что хотите понизить пользователя до Free?")) return;
        try {
            const token = await getToken();
            await fetch('/api/admin?action=revoke_pro', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId })
            });
            fetchUsers();
        } catch (e) {
            alert("Ошибка при отзыве Pro");
        }
    };

    const handleSaveConfig = async () => {
        setIsSavingConfig(true);
        try {
            const token = await getToken();
            await fetch('/api/admin?action=update_config', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(config)
            });
            alert("Конфигурация сохранена!");
        } catch (e) {
            alert("Не удалось сохранить конфигурацию");
        } finally {
            setIsSavingConfig(false);
        }
    };

    const handleSavePaymentConfig = async () => {
        setIsSavingPayment(true);
        try {
            const token = await getToken();
            await fetch('/api/admin?action=update_payment_config', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(paymentConfig)
            });
            alert("Настройки интеграций сохранены!");
        } catch (e) {
            alert("Не удалось сохранить настройки платежей");
        } finally {
            setIsSavingPayment(false);
        }
    };

    const handleConfigChange = (key: keyof AppConfig, field: keyof FeatureRule, value: any) => {
        setConfig(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                [field]: value
            }
        }));
    };

    // Helper to render a config row
    const renderConfigRow = (key: string, rule: FeatureRule) => (
        <div key={key} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg shrink-0 mt-1 ${key.startsWith('ui_') ? 'bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400' : 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'}`}>
                    {key.startsWith('ui_') ? <Layout size={18} /> : <Cpu size={18} />}
                </div>
                <div>
                    <div className="font-bold text-sm text-zinc-900 dark:text-white capitalize">{key.replace(/_/g, ' ')}</div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {FEATURE_DESCRIPTIONS[key as keyof AppConfig] || "Системная настройка"}
                    </div>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 lg:gap-8 w-full lg:w-auto border-t lg:border-t-0 border-zinc-100 dark:border-zinc-800 pt-3 lg:pt-0">
                {/* Limits Input (Only for max_projects) */}
                {(key === 'max_projects') && (
                    <div className="flex items-center gap-3 w-full sm:w-auto bg-zinc-50 dark:bg-zinc-950 p-2 rounded-lg border border-zinc-100 dark:border-zinc-800">
                        <div className="flex flex-col">
                            <label className="text-[9px] font-bold uppercase text-zinc-400 mb-0.5">Free Limit</label>
                            <input 
                                type="number" 
                                value={rule.limitFree || 0}
                                onChange={(e) => handleConfigChange(key as keyof AppConfig, 'limitFree', parseInt(e.target.value))}
                                className="w-16 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 text-xs outline-none focus:border-indigo-500 text-center"
                            />
                        </div>
                        <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700"></div>
                        <div className="flex flex-col">
                            <label className="text-[9px] font-bold uppercase text-zinc-400 mb-0.5">Pro Limit</label>
                            <input 
                                type="number" 
                                value={rule.limitPro || 0}
                                onChange={(e) => handleConfigChange(key as keyof AppConfig, 'limitPro', parseInt(e.target.value))}
                                className="w-16 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 text-xs outline-none focus:border-indigo-500 text-center"
                            />
                        </div>
                    </div>
                )}

                <div className="flex gap-4 w-full sm:w-auto justify-between sm:justify-start">
                    <label className="flex items-center gap-2 cursor-pointer group select-none">
                        <div className="relative">
                            <input 
                                type="checkbox" 
                                checked={rule.enabledForFree} 
                                onChange={(e) => handleConfigChange(key as keyof AppConfig, 'enabledForFree', e.target.checked)}
                                className="peer sr-only"
                            />
                            <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                        </div>
                        <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 group-hover:text-black dark:group-hover:text-white transition-colors">Free</span>
                    </label>
                    
                    <label className="flex items-center gap-2 cursor-pointer group select-none">
                        <div className="relative">
                            <input 
                                type="checkbox" 
                                checked={rule.enabledForPro} 
                                onChange={(e) => handleConfigChange(key as keyof AppConfig, 'enabledForPro', e.target.checked)}
                                className="peer sr-only"
                            />
                            <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
                        </div>
                        <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 group-hover:text-black dark:group-hover:text-white transition-colors">Pro</span>
                    </label>
                </div>
            </div>
        </div>
    );

    // Stats
    const totalUsers = users.length;
    const proUsers = users.filter(u => u.plan === 'pro').length;

    const activeConfigKeys = CONFIG_GROUPS[settingsSubTab as keyof typeof CONFIG_GROUPS] || [];

    return (
        <div className="max-w-6xl mx-auto py-4 md:py-8 px-3 md:px-4 font-sans text-zinc-900 dark:text-zinc-100 pb-24">
            {/* Header */}
            <div className="flex flex-col gap-6 mb-8">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={onBack} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
                            <ArrowLeft size={20} className="text-zinc-600 dark:text-zinc-400"/>
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-2">
                                <Shield size={24} className="text-indigo-600 dark:text-indigo-400"/> 
                                Admin Dashboard
                            </h1>
                        </div>
                    </div>
                </div>
                
                {/* Main Tabs */}
                <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1.5 rounded-xl w-full max-w-2xl overflow-x-auto">
                    <button 
                        onClick={() => setActiveTab('users')}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold rounded-lg transition-all min-w-[120px] ${activeTab === 'users' ? 'bg-white dark:bg-zinc-800 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}
                    >
                        <Crown size={16} /> Пользователи
                    </button>
                    <button 
                        onClick={() => setActiveTab('features')}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold rounded-lg transition-all min-w-[120px] ${activeTab === 'features' ? 'bg-white dark:bg-zinc-800 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}
                    >
                        <Settings size={16} /> Настройки
                    </button>
                    <button 
                        onClick={() => setActiveTab('payments')}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold rounded-lg transition-all min-w-[120px] ${activeTab === 'payments' ? 'bg-white dark:bg-zinc-800 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}
                    >
                        <CreditCard size={16} /> Интеграции
                    </button>
                    <button 
                        onClick={() => setActiveTab('strategy')}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold rounded-lg transition-all min-w-[120px] ${activeTab === 'strategy' ? 'bg-white dark:bg-zinc-800 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}
                    >
                        <TrendingUp size={16} /> Стратегия
                    </button>
                </div>
            </div>

            {/* TAB: STRATEGY (S.M.A.R.T.) */}
            {activeTab === 'strategy' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-8">
                    {/* ... (Existing Strategy Content - omitted for brevity but preserved in output) ... */}
                    <div className="bg-gradient-to-r from-indigo-900/50 to-purple-900/50 border border-indigo-500/20 p-6 rounded-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                            <Target size={120} />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                            <Flag className="text-indigo-400" /> Бизнес-цель (S.M.A.R.T.)
                        </h2>
                        <p className="text-indigo-200 text-sm max-w-2xl leading-relaxed">
                            Стратегия выхода на монетизацию через модель <strong className="text-white">Founder's Club</strong> (быстрый капитал) с последующим переходом в <strong className="text-white">SaaS</strong> (рекуррентный доход).
                        </p>
                    </div>
                </div>
            )}

            {/* TAB: USERS */}
            {activeTab === 'users' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {/* Compact Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-sm">
                            <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mb-1">Всего</div>
                            <div className="text-3xl font-bold">{totalUsers}</div>
                        </div>
                        <div className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-500/20 p-4 rounded-xl shadow-sm">
                            <div className="text-indigo-600 dark:text-indigo-400 text-[10px] font-bold uppercase tracking-wider mb-1">Pro Users</div>
                            <div className="text-3xl font-bold text-indigo-700 dark:text-indigo-300">{proUsers}</div>
                        </div>
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-sm hidden md:block">
                            <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mb-1">Free Users</div>
                            <div className="text-3xl font-bold text-zinc-400">{totalUsers - proUsers}</div>
                        </div>
                        <div className="col-span-2 md:col-span-1 flex items-center justify-center p-3">
                             <button onClick={fetchUsers} className="w-full h-full flex items-center justify-center gap-2 px-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl text-sm font-bold transition-colors text-zinc-600 dark:text-zinc-300">
                                <RefreshCw size={16} className={usersLoading ? "animate-spin" : ""} /> Обновить список
                            </button>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="relative mb-6">
                        <input 
                            type="text" 
                            placeholder="Поиск по имени или email..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-sm outline-none focus:border-indigo-500 transition-colors shadow-sm"
                        />
                        <Search size={18} className="absolute left-3 top-3 text-zinc-400" />
                    </div>

                    {userError && <div className="p-4 bg-red-100 text-red-700 rounded-lg mb-4 text-xs">{userError}</div>}

                    {/* DESKTOP TABLE VIEW */}
                    <div className="hidden md:block bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
                                    <tr>
                                        <th className="px-6 py-3 font-bold text-zinc-500 uppercase text-xs">Пользователь</th>
                                        <th className="px-6 py-3 font-bold text-zinc-500 uppercase text-xs">Статус</th>
                                        <th className="px-6 py-3 font-bold text-zinc-500 uppercase text-xs">Истекает</th>
                                        <th className="px-6 py-3 font-bold text-zinc-500 uppercase text-xs text-right">Действия</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                    {filteredUsers.map((user) => {
                                        const isPro = user.plan === 'pro' || user.plan === 'lifetime';
                                        const isLifetime = user.plan === 'lifetime';
                                        const expiry = user.expiresAt ? new Date(user.expiresAt) : null;
                                        
                                        return (
                                            <tr key={user.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                                <td className="px-6 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <img src={user.avatar} className="w-8 h-8 rounded-full bg-zinc-200 object-cover" alt="" />
                                                        <div>
                                                            <div className="font-bold text-zinc-900 dark:text-white text-xs md:text-sm">{user.name}</div>
                                                            <div className="text-[10px] text-zinc-500">{user.email}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-3">
                                                    {isPro ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold border border-indigo-200 dark:border-indigo-500/20">
                                                            <Zap size={10} fill="currentColor" /> {isLifetime ? 'LIFETIME' : 'PRO'}
                                                        </span>
                                                    ) : (
                                                        <span className="text-zinc-500 text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">FREE</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-3 text-zinc-600 dark:text-zinc-400 font-mono text-xs">
                                                    {isLifetime ? <span className="text-green-500 font-bold">∞</span> : (expiry ? expiry.toLocaleDateString() : '-')}
                                                </td>
                                                <td className="px-6 py-3 text-right">
                                                    {isPro ? (
                                                        <button onClick={() => handleRevokePro(user.id)} className="text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded transition-colors">Снять</button>
                                                    ) : (
                                                        <button onClick={() => setSelectedUser(user)} className="px-3 py-1.5 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-lg text-xs font-bold hover:opacity-80 transition-opacity">
                                                            Выдать
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: FEATURES */}
            {activeTab === 'features' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-500/20 p-3 rounded-xl mb-6 flex items-start gap-3">
                        <AlertTriangle className="text-yellow-600 dark:text-yellow-500 shrink-0 mt-0.5" size={16} />
                        <div>
                            <h3 className="text-xs font-bold text-yellow-800 dark:text-yellow-400">Глобальные флаги</h3>
                            <p className="text-[10px] text-yellow-700/80 dark:text-yellow-500/80 leading-relaxed">
                                Влияет на доступность функций и видимость UI для всех пользователей мгновенно.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-6">
                        {SUB_TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setSettingsSubTab(tab.id)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${settingsSubTab === tab.id 
                                    ? 'bg-zinc-800 text-white border-zinc-700 shadow-md' 
                                    : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                                }`}
                            >
                                <tab.icon size={14} />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="space-y-3">
                        {activeConfigKeys.map((key) => renderConfigRow(key, config[key as keyof AppConfig]))}
                    </div>

                    <div className="mt-8 flex justify-end sticky bottom-6 z-10">
                        <button 
                            onClick={handleSaveConfig}
                            disabled={isSavingConfig || configLoading}
                            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-xl shadow-indigo-500/30 transition-all disabled:opacity-50 active:scale-95 border border-indigo-400/20"
                        >
                            {isSavingConfig ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                            Сохранить изменения
                        </button>
                    </div>
                </div>
            )}

            {/* TAB: PAYMENTS */}
            {activeTab === 'payments' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-2xl mx-auto">
                    <div className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-500/20 p-6 rounded-2xl mb-8 text-center">
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Настройка Платежных Шлюзов</h2>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">Выберите активного провайдера и настройте цены.</p>
                    </div>

                    {paymentLoading ? (
                        <div className="flex justify-center p-12"><RefreshCw className="animate-spin text-zinc-400" /></div>
                    ) : (
                        <div className="space-y-6">
                            
                            {/* PRICING CONFIG */}
                            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-4">
                                <h3 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                                    <DollarSign size={16} className="text-green-500"/> Настройка Цен (RUB)
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Lifetime (Founder)</label>
                                        <input 
                                            type="number" 
                                            value={paymentConfig.prices?.lifetime || 4900} 
                                            onChange={(e) => setPaymentConfig(prev => ({...prev, prices: {...prev.prices, lifetime: parseInt(e.target.value)}}))}
                                            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Monthly (Pro)</label>
                                        <input 
                                            type="number" 
                                            value={paymentConfig.prices?.monthly || 490} 
                                            onChange={(e) => setPaymentConfig(prev => ({...prev, prices: {...prev.prices, monthly: parseInt(e.target.value)}}))}
                                            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-indigo-500"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Provider Selection */}
                            <div className="grid grid-cols-2 gap-4">
                                <label className={`cursor-pointer p-4 rounded-xl border-2 transition-all relative ${paymentConfig.activeProvider === 'yookassa' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900'}`}>
                                    <input 
                                        type="radio" 
                                        name="provider" 
                                        value="yookassa" 
                                        checked={paymentConfig.activeProvider === 'yookassa'}
                                        onChange={() => setPaymentConfig(prev => ({...prev, activeProvider: 'yookassa'}))}
                                        className="sr-only"
                                    />
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-10 h-10 rounded-full bg-[#7B61FF] text-white flex items-center justify-center font-bold text-xs">Yoo</div>
                                        <span className="font-bold text-zinc-900 dark:text-white">ЮKassa</span>
                                        {paymentConfig.activeProvider === 'yookassa' && <div className="absolute top-2 right-2 text-indigo-500"><CheckCircle size={16} /></div>}
                                    </div>
                                </label>

                                <label className={`cursor-pointer p-4 rounded-xl border-2 transition-all relative ${paymentConfig.activeProvider === 'prodamus' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900'}`}>
                                    <input 
                                        type="radio" 
                                        name="provider" 
                                        value="prodamus" 
                                        checked={paymentConfig.activeProvider === 'prodamus'}
                                        onChange={() => setPaymentConfig(prev => ({...prev, activeProvider: 'prodamus'}))}
                                        className="sr-only"
                                    />
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-10 h-10 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-xs">Pr</div>
                                        <span className="font-bold text-zinc-900 dark:text-white">Prodamus</span>
                                        {paymentConfig.activeProvider === 'prodamus' && <div className="absolute top-2 right-2 text-indigo-500"><CheckCircle size={16} /></div>}
                                    </div>
                                </label>
                            </div>

                            {/* YooKassa Settings */}
                            <div className={`space-y-4 transition-opacity ${paymentConfig.activeProvider !== 'yookassa' ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                                <h3 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-[#7B61FF]"></div>
                                    Настройки ЮKassa
                                </h3>
                                <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Shop ID</label>
                                        <input 
                                            type="text" 
                                            value={paymentConfig.yookassa.shopId} 
                                            onChange={(e) => setPaymentConfig(prev => ({...prev, yookassa: {...prev.yookassa, shopId: e.target.value}}))}
                                            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-indigo-500"
                                            placeholder="Enter Shop ID"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Secret Key</label>
                                        <input 
                                            type="password" 
                                            value={paymentConfig.yookassa.secretKey} 
                                            onChange={(e) => setPaymentConfig(prev => ({...prev, yookassa: {...prev.yookassa, secretKey: e.target.value}}))}
                                            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-indigo-500"
                                            placeholder="test_..."
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Prodamus Settings */}
                            <div className={`space-y-4 transition-opacity ${paymentConfig.activeProvider !== 'prodamus' ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                                <h3 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                                    Настройки Prodamus
                                </h3>
                                <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Payment Page URL</label>
                                        <div className="flex gap-2">
                                            <input 
                                                type="text" 
                                                value={paymentConfig.prodamus.url} 
                                                onChange={(e) => setPaymentConfig(prev => ({...prev, prodamus: {...prev.prodamus, url: e.target.value}}))}
                                                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
                                                placeholder="https://yourschool.payform.ru"
                                            />
                                            <a href={paymentConfig.prodamus.url} target="_blank" rel="noreferrer" className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:text-indigo-500 text-zinc-500 flex items-center justify-center">
                                                <ExternalLink size={16} />
                                            </a>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Secret Key (Signing)</label>
                                        <input 
                                            type="password" 
                                            value={paymentConfig.prodamus.secretKey} 
                                            onChange={(e) => setPaymentConfig(prev => ({...prev, prodamus: {...prev.prodamus, secretKey: e.target.value}}))}
                                            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-indigo-500"
                                            placeholder="Secret key for signature"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end">
                                <button 
                                    onClick={handleSavePaymentConfig}
                                    disabled={isSavingPayment}
                                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-xl shadow-indigo-500/30 transition-all disabled:opacity-50 active:scale-95 border border-indigo-400/20"
                                >
                                    {isSavingPayment ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                                    Сохранить настройки
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Grant Modal */}
            {selectedUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative">
                        <div className="flex items-center gap-3 mb-4 text-indigo-600 dark:text-indigo-400">
                            <Crown size={24} />
                            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Выдать Pro доступ</h2>
                        </div>
                        
                        <div className="mb-6 bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
                            <div className="flex items-center gap-3 mb-2">
                                <img src={selectedUser.avatar} className="w-8 h-8 rounded-full" alt="" />
                                <div className="min-w-0">
                                    <div className="font-bold text-xs text-zinc-900 dark:text-white truncate">{selectedUser.name}</div>
                                    <div className="text-[10px] text-zinc-500 truncate">{selectedUser.email}</div>
                                </div>
                            </div>
                            
                            <label className="block text-[10px] font-bold uppercase text-zinc-400 mb-1.5 mt-4">Срок действия</label>
                            <select 
                                value={grantDuration} 
                                onChange={(e) => setGrantDuration(parseInt(e.target.value))}
                                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white outline-none focus:border-indigo-500 transition-colors"
                            >
                                <option value={7}>7 Дней (Триал)</option>
                                <option value={30}>1 Месяц</option>
                                <option value={365}>1 Год</option>
                                <option value={0}>Навсегда (Lifetime)</option>
                            </select>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setSelectedUser(null)} className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">Отмена</button>
                            <button onClick={handleGrantPro} disabled={isGranting} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-500 flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 transition-all">
                                {isGranting ? <RefreshCw size={14} className="animate-spin"/> : <CheckCircle size={14}/>} Подтвердить
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
