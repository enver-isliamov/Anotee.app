
import React, { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Shield, RefreshCw, ArrowLeft, CheckCircle, Zap, Settings, Save, AlertTriangle } from 'lucide-react';
import { FeatureRule, AppConfig, DEFAULT_CONFIG } from '../types';

interface AdminUser {
    id: string;
    name: string;
    email: string;
    avatar: string;
    plan: 'free' | 'pro';
    expiresAt: number | null;
    isAutoRenew: boolean;
    lastActive: number;
}

const FEATURE_DESCRIPTIONS: Record<keyof AppConfig, string> = {
    max_projects: "Лимиты проектов (Количество проектов)",
    export_xml: "Экспорт в DaVinci Resolve (XML)",
    export_csv: "Экспорт в Premiere/Excel (CSV)",
    google_drive: "Интеграция с Google Drive и загрузка",
    ai_transcription: "AI Транскрибация речи",
    team_collab: "Приглашение в команду и совместная работа"
};

export const AdminPanel: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { getToken } = useAuth();
    const [activeTab, setActiveTab] = useState<'users' | 'features'>('users');
    
    // User Data
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [usersLoading, setUsersLoading] = useState(true);
    const [userError, setUserError] = useState('');
    
    // Config Data
    const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
    const [configLoading, setConfigLoading] = useState(false);
    const [isSavingConfig, setIsSavingConfig] = useState(false);

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
        } catch (e: any) {
            setUserError(e.message);
        } finally {
            setUsersLoading(false);
        }
    };

    const fetchConfig = async () => {
        setConfigLoading(true);
        try {
            const token = await getToken();
            const res = await fetch('/api/admin?action=get_config', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                // Merge with default to ensure all keys exist
                setConfig({ ...DEFAULT_CONFIG, ...data });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setConfigLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'users') fetchUsers();
        if (activeTab === 'features') fetchConfig();
    }, [activeTab]);

    const handleGrantPro = async () => {
        if (!selectedUser) return;
        setIsGranting(true);
        try {
            const token = await getToken();
            // 0 days = lifetime logic in backend
            await fetch('/api/admin?action=grant_pro', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId: selectedUser.id, days: grantDuration })
            });
            setSelectedUser(null);
            fetchUsers(); // Refresh list
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

    const handleConfigChange = (key: keyof AppConfig, field: keyof FeatureRule, value: any) => {
        setConfig(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                [field]: value
            }
        }));
    };

    // Stats
    const totalUsers = users.length;
    const proUsers = users.filter(u => u.plan === 'pro').length;

    return (
        <div className="max-w-6xl mx-auto py-8 px-4 font-sans text-zinc-900 dark:text-zinc-100">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
                        <ArrowLeft size={20} className="text-zinc-600 dark:text-zinc-400"/>
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Shield fill="currentColor" className="text-indigo-600 dark:text-indigo-400"/> Панель Администратора
                        </h1>
                        <p className="text-sm text-zinc-500">Управление пользователями, подписками и флагами системы</p>
                    </div>
                </div>
                
                <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1 rounded-lg">
                    <button 
                        onClick={() => setActiveTab('users')}
                        className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${activeTab === 'users' ? 'bg-white dark:bg-zinc-800 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}
                    >
                        Пользователи
                    </button>
                    <button 
                        onClick={() => setActiveTab('features')}
                        className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${activeTab === 'features' ? 'bg-white dark:bg-zinc-800 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}
                    >
                        Настройки функций
                    </button>
                </div>
            </div>

            {/* TAB: USERS */}
            {activeTab === 'users' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl">
                            <div className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1">Всего пользователей</div>
                            <div className="text-3xl font-bold">{totalUsers}</div>
                        </div>
                        <div className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-500/20 p-4 rounded-xl">
                            <div className="text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1">Pro Аккаунты</div>
                            <div className="text-3xl font-bold text-indigo-700 dark:text-indigo-300">{proUsers}</div>
                        </div>
                        <div className="flex items-center justify-end">
                             <button onClick={fetchUsers} className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-sm font-bold transition-colors">
                                <RefreshCw size={16} className={usersLoading ? "animate-spin" : ""} /> Обновить список
                            </button>
                        </div>
                    </div>

                    {userError && <div className="p-4 bg-red-100 text-red-700 rounded-lg mb-4">{userError}</div>}

                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
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
                                    {users.map((user) => {
                                        const isPro = user.plan === 'pro';
                                        const expiry = user.expiresAt ? new Date(user.expiresAt) : null;
                                        const isLifetime = isPro && expiry && expiry.getFullYear() > 2050;
                                        
                                        return (
                                            <tr key={user.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <img src={user.avatar} className="w-8 h-8 rounded-full bg-zinc-200" alt="" />
                                                        <div>
                                                            <div className="font-bold text-zinc-900 dark:text-white">{user.name}</div>
                                                            <div className="text-xs text-zinc-500">{user.email}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {isPro ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-bold border border-indigo-200 dark:border-indigo-500/20">
                                                            <Zap size={10} fill="currentColor" /> PRO
                                                        </span>
                                                    ) : (
                                                        <span className="text-zinc-500 text-xs font-bold bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">FREE</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400 font-mono text-xs">
                                                    {isLifetime ? <span className="text-green-500 font-bold">Вечный</span> : (expiry ? expiry.toLocaleDateString() : '-')}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {isPro ? (
                                                        <button onClick={() => handleRevokePro(user.id)} className="text-xs text-red-500 hover:text-red-700 hover:underline">Понизить до Free</button>
                                                    ) : (
                                                        <button onClick={() => setSelectedUser(user)} className="px-3 py-1.5 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-lg text-xs font-bold hover:opacity-80 transition-opacity">
                                                            Выдать Pro
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
                    <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-500/20 p-4 rounded-xl mb-6 flex items-start gap-3">
                        <AlertTriangle className="text-yellow-600 dark:text-yellow-500 shrink-0" size={20} />
                        <div>
                            <h3 className="text-sm font-bold text-yellow-800 dark:text-yellow-400">Глобальные флаги функций</h3>
                            <p className="text-xs text-yellow-700/80 dark:text-yellow-500/80">
                                Эти настройки управляют доступом для ВСЕХ пользователей мгновенно. Изменения применяются сразу после обновления страницы.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {Object.entries(config).map(([key, rule]) => (
                            <div key={key} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                                        <Settings size={18} className="text-zinc-500" />
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm text-zinc-900 dark:text-white capitalize">{key.replace('_', ' ')}</div>
                                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                            {FEATURE_DESCRIPTIONS[key as keyof AppConfig] || "Системная функция"}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6">
                                    {/* Limits Input */}
                                    {(key === 'max_projects') && (
                                        <div className="flex items-center gap-2 mr-4">
                                            <div className="flex flex-col">
                                                <label className="text-[9px] font-bold uppercase text-zinc-400">Лимит Free</label>
                                                <input 
                                                    type="number" 
                                                    value={rule.limitFree || 0}
                                                    onChange={(e) => handleConfigChange(key as keyof AppConfig, 'limitFree', parseInt(e.target.value))}
                                                    className="w-16 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 text-xs"
                                                />
                                            </div>
                                            <div className="flex flex-col">
                                                <label className="text-[9px] font-bold uppercase text-zinc-400">Лимит Pro</label>
                                                <input 
                                                    type="number" 
                                                    value={rule.limitPro || 0}
                                                    onChange={(e) => handleConfigChange(key as keyof AppConfig, 'limitPro', parseInt(e.target.value))}
                                                    className="w-16 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 text-xs"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Checkboxes */}
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={rule.enabledForFree} 
                                            onChange={(e) => handleConfigChange(key as keyof AppConfig, 'enabledForFree', e.target.checked)}
                                            className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Вкл. для Free</span>
                                    </label>
                                    
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={rule.enabledForPro} 
                                            onChange={(e) => handleConfigChange(key as keyof AppConfig, 'enabledForPro', e.target.checked)}
                                            className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Вкл. для Pro</span>
                                    </label>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-8 flex justify-end">
                        <button 
                            onClick={handleSaveConfig}
                            disabled={isSavingConfig || configLoading}
                            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
                        >
                            {isSavingConfig ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                            Сохранить конфигурацию
                        </button>
                    </div>
                </div>
            )}

            {/* Grant Modal */}
            {selectedUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative">
                        <h2 className="text-xl font-bold mb-4 dark:text-white">Выдать Pro доступ</h2>
                        <div className="mb-4">
                            <p className="text-sm text-zinc-500 mb-2">Пользователь: <strong>{selectedUser.email}</strong></p>
                            <label className="block text-xs font-bold uppercase text-zinc-400 mb-1.5">Срок действия</label>
                            <select 
                                value={grantDuration} 
                                onChange={(e) => setGrantDuration(parseInt(e.target.value))}
                                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm dark:text-white outline-none focus:border-indigo-500"
                            >
                                <option value={7}>7 Дней (Триал)</option>
                                <option value={30}>1 Месяц</option>
                                <option value={365}>1 Год</option>
                                <option value={0}>Навсегда (Lifetime)</option>
                            </select>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setSelectedUser(null)} className="flex-1 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">Отмена</button>
                            <button onClick={handleGrantPro} disabled={isGranting} className="flex-1 py-2 rounded-lg bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-500 flex items-center justify-center gap-2">
                                {isGranting ? <RefreshCw size={14} className="animate-spin"/> : <CheckCircle size={14}/>} Подтвердить
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
