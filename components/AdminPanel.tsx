
import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Shield, RefreshCw, ArrowLeft, CheckCircle, Zap, Settings, Save, AlertTriangle, Search, Crown, Layout, Cpu, Download, Sparkles, Sliders, Globe, HardDrive, TrendingUp, Target, Lightbulb, ListTodo, Flag, BarChart3, CreditCard, ExternalLink, DollarSign, Edit3, Lock, Unlock, CheckCircle2, Circle, Plus, Trash2, X, GripVertical, Users, FlaskConical } from 'lucide-react';
import { FeatureRule, AppConfig, DEFAULT_CONFIG, PaymentConfig, DEFAULT_PAYMENT_CONFIG, PlanConfig, PlanFeature } from '../types';

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
    sharing_project: "Шеринг Проекта (Team Invite)",
    sharing_public_link: "Публичные ссылки (Review Link)",
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
    general: ['max_projects', 'project_locking', 'version_comparison'],
    sharing: ['sharing_project', 'sharing_public_link'],
    export: ['export_xml', 'export_csv', 'local_file_link'],
    ai: ['ai_transcription', 'high_res_proxies', 'google_drive'],
    ui: ['ui_upsell_banner', 'ui_roadmap_block', 'ui_help_button', 'ui_footer', 'ui_drive_connect']
};

const SUB_TABS = [
    { id: 'general', label: 'Основные', icon: Sliders },
    { id: 'sharing', label: 'Доступ и Шеринг', icon: Users },
    { id: 'export', label: 'Экспорт', icon: Download },
    { id: 'ai', label: 'AI и Облако', icon: Sparkles },
    { id: 'ui', label: 'Интерфейс', icon: Layout },
];

export const AdminPanel: React.FC<{ onBack: () => void, onNavigate?: (page: string) => void }> = ({ onBack, onNavigate }) => {
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

    // Drag and Drop Refs
    const dragItem = useRef<{ type: 'PLAN' | 'FEATURE', index: number, parentId?: string } | null>(null);
    const dragOverItem = useRef<{ type: 'PLAN' | 'FEATURE', index: number, parentId?: string } | null>(null);

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

                setPaymentConfig({ 
                    ...DEFAULT_PAYMENT_CONFIG, 
                    ...data, 
                    planOrder: data.planOrder || DEFAULT_PAYMENT_CONFIG.planOrder,
                    prices: { ...DEFAULT_PAYMENT_CONFIG.prices, ...(data.prices || {}) },
                    plans: mergedPlans,
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

    // Helper for editing plan details
    const handlePlanChange = (planId: keyof typeof paymentConfig.plans, field: keyof PlanConfig, value: any) => {
        setPaymentConfig(prev => ({
            ...prev,
            plans: {
                ...prev.plans,
                [planId]: {
                    ...prev.plans[planId],
                    [field]: value
                }
            }
        }));
    };

    // Helper to edit a specific feature inside a plan
    const handleFeatureChange = (planId: keyof typeof paymentConfig.plans, featureIndex: number, field: keyof PlanFeature, value: any) => {
        const plan = paymentConfig.plans[planId];
        const newFeatures = [...plan.features];
        newFeatures[featureIndex] = { ...newFeatures[featureIndex], [field]: value };
        handlePlanChange(planId, 'features', newFeatures);
    };

    const addFeature = (planId: keyof typeof paymentConfig.plans) => {
        const plan = paymentConfig.plans[planId];
        const newFeatures = [...plan.features, { title: 'New Feature', desc: 'Description', isCore: false }];
        handlePlanChange(planId, 'features', newFeatures);
    };

    const removeFeature = (planId: keyof typeof paymentConfig.plans, featureIndex: number) => {
        const plan = paymentConfig.plans[planId];
        const newFeatures = plan.features.filter((_, i) => i !== featureIndex);
        handlePlanChange(planId, 'features', newFeatures);
    };

    // --- DRAG AND DROP HANDLERS ---

    const onDragStart = (e: React.DragEvent, type: 'PLAN' | 'FEATURE', index: number, parentId?: string) => {
        dragItem.current = { type, index, parentId };
        e.dataTransfer.effectAllowed = "move";
    };

    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault(); 
    };

    const onDrop = (e: React.DragEvent, type: 'PLAN' | 'FEATURE', targetIndex: number, parentId?: string) => {
        e.preventDefault();
        
        if (!dragItem.current) return;
        if (dragItem.current.type !== type) return;
        if (dragItem.current.index === targetIndex && dragItem.current.parentId === parentId) return;

        if (type === 'PLAN') {
            const newOrder = [...paymentConfig.planOrder];
            const draggedPlanKey = newOrder[dragItem.current.index];
            newOrder.splice(dragItem.current.index, 1);
            newOrder.splice(targetIndex, 0, draggedPlanKey);
            setPaymentConfig(prev => ({
                ...prev,
                planOrder: newOrder
            }));
        } else if (type === 'FEATURE' && parentId === dragItem.current.parentId) {
            const planKey = parentId as keyof typeof paymentConfig.plans;
            const features = [...paymentConfig.plans[planKey].features];
            const draggedFeature = features[dragItem.current.index];
            features.splice(dragItem.current.index, 1);
            features.splice(targetIndex, 0, draggedFeature);
            handlePlanChange(planKey, 'features', features);
        }
        dragItem.current = null;
    };

    // Render Plan Editor Card
    const renderPlanEditor = (planKey: string, index: number) => {
        const plan = paymentConfig.plans[planKey as keyof typeof paymentConfig.plans];
        if (!plan) return null;
        
        return (
            <div 
                key={planKey}
                draggable
                onDragStart={(e) => onDragStart(e, 'PLAN', index)}
                onDragOver={onDragOver}
                onDrop={(e) => onDrop(e, 'PLAN', index)}
                className={`p-4 rounded-2xl border transition-all cursor-default flex flex-col h-full ${plan.isActive ? 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800' : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 opacity-70 grayscale-[0.5]'}`}
            >
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2">
                        <div className="cursor-move text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1">
                            <GripVertical size={16} />
                        </div>
                        <div className={`w-3 h-3 rounded-full ${plan.isActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <h4 className="font-bold text-sm uppercase">{planKey}</h4>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={plan.isActive} onChange={(e) => handlePlanChange(planKey as any, 'isActive', e.target.checked)} className="sr-only peer" />
                        <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                    </label>
                </div>

                <div className="space-y-4 pl-0 md:pl-2 flex-1 flex flex-col">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="col-span-2">
                            <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Title</label>
                            <input type="text" value={plan.title} onChange={(e) => handlePlanChange(planKey as any, 'title', e.target.value)} className="w-full bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1.5 text-xs font-bold"/>
                        </div>
                        <div className="col-span-2">
                            <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Subtitle</label>
                            <input type="text" value={plan.subtitle || ''} onChange={(e) => handlePlanChange(planKey as any, 'subtitle', e.target.value)} className="w-full bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1.5 text-xs"/>
                        </div>
                        <div>
                            <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Price</label>
                            <input type="number" value={plan.price} onChange={(e) => handlePlanChange(planKey as any, 'price', parseInt(e.target.value))} className="w-full bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1.5 text-xs font-mono"/>
                        </div>
                        <div>
                            <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Sym</label>
                            <input type="text" value={plan.currency} onChange={(e) => handlePlanChange(planKey as any, 'currency', e.target.value)} className="w-full bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1.5 text-xs font-mono text-center"/>
                        </div>
                    </div>

                    <div className="flex-1">
                        <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-2">Features</label>
                        <div className="space-y-2">
                            {plan.features.map((f, i) => (
                                <div 
                                    key={i} 
                                    draggable
                                    onDragStart={(e) => { e.stopPropagation(); onDragStart(e, 'FEATURE', i, planKey); }}
                                    onDragOver={onDragOver}
                                    onDrop={(e) => { e.stopPropagation(); onDrop(e, 'FEATURE', i, planKey); }}
                                    className="flex gap-2 items-start bg-zinc-50 dark:bg-zinc-950 p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 group"
                                >
                                    <div className="cursor-move text-zinc-300 hover:text-zinc-500 pt-1">
                                        <GripVertical size={14} />
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <input 
                                            type="text" 
                                            placeholder="Title"
                                            value={f.title}
                                            onChange={(e) => handleFeatureChange(planKey as any, i, 'title', e.target.value)}
                                            className="w-full bg-transparent border-b border-zinc-200 dark:border-zinc-800 text-xs font-bold px-1 py-0.5 outline-none focus:border-indigo-500"
                                        />
                                        <input 
                                            type="text" 
                                            placeholder="Description (Optional)"
                                            value={f.desc}
                                            onChange={(e) => handleFeatureChange(planKey as any, i, 'desc', e.target.value)}
                                            className="w-full bg-transparent text-[10px] text-zinc-500 px-1 py-0.5 outline-none"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1 items-center">
                                        <button 
                                            onClick={() => handleFeatureChange(planKey as any, i, 'isCore', !f.isCore)}
                                            className={`p-1 rounded ${f.isCore ? 'bg-green-100 text-green-600' : 'text-zinc-300 hover:text-zinc-500'}`}
                                            title="Toggle Core Feature"
                                        >
                                            <Zap size={12} fill={f.isCore ? "currentColor" : "none"}/>
                                        </button>
                                        <button onClick={() => removeFeature(planKey as any, i)} className="text-zinc-300 hover:text-red-500 p-1"><X size={12}/></button>
                                    </div>
                                </div>
                            ))}
                            <button onClick={() => addFeature(planKey as any)} className="w-full py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-lg text-xs font-bold hover:text-indigo-500 flex items-center justify-center gap-1">
                                <Plus size={14} /> Add Feature
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white font-sans p-6 md:p-8">
            <div className="max-w-[1400px] mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <button onClick={onBack} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors">
                            <ArrowLeft size={24} />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-2">
                                <Shield className="text-indigo-600" /> Admin Console
                            </h1>
                            <p className="text-xs text-zinc-500">System Management & Configuration</p>
                        </div>
                    </div>
                    {/* TEST RUNNER BUTTON */}
                    <div className="flex items-center gap-2">
                        {onNavigate && (
                            <button 
                                onClick={() => onNavigate('TEST_RUNNER')}
                                className="flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-zinc-800 hover:bg-zinc-800 dark:hover:bg-zinc-700 text-white rounded-lg font-bold text-sm transition-all shadow-sm"
                            >
                                <FlaskConical size={16} />
                                System Tests
                            </button>
                        )}
                        <div className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-bold border border-green-200 dark:border-green-800">
                            Super Admin
                        </div>
                    </div>
                </div>

                {/* TABS */}
                <div className="flex border-b border-zinc-200 dark:border-zinc-800 mb-8 overflow-x-auto">
                    {['users', 'features', 'payments', 'strategy'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap capitalize ${activeTab === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-white'}`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* CONTENT */}
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                    
                    {/* USERS TAB */}
                    {activeTab === 'users' && (
                        <div>
                            <div className="flex justify-between items-center mb-6">
                                <div className="relative w-full max-w-sm">
                                    <Search className="absolute left-3 top-2.5 text-zinc-400" size={18} />
                                    <input 
                                        type="text" 
                                        placeholder="Search users..." 
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-sm focus:border-indigo-500 outline-none"
                                    />
                                </div>
                                <button onClick={fetchUsers} className="p-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-700"><RefreshCw size={18} /></button>
                            </div>

                            {usersLoading ? (
                                <div className="flex justify-center p-12 text-zinc-400">Loading users...</div>
                            ) : (
                                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-zinc-50 dark:bg-zinc-800 text-zinc-500 font-medium uppercase text-xs">
                                            <tr>
                                                <th className="px-6 py-3">User</th>
                                                <th className="px-6 py-3">Plan</th>
                                                <th className="px-6 py-3">Expires</th>
                                                <th className="px-6 py-3">Auto-Renew</th>
                                                <th className="px-6 py-3">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                            {filteredUsers.map(user => (
                                                <tr key={user.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                                    <td className="px-6 py-4 flex items-center gap-3">
                                                        <img src={user.avatar} className="w-8 h-8 rounded-full" />
                                                        <div>
                                                            <div className="font-bold">{user.name}</div>
                                                            <div className="text-xs text-zinc-500">{user.email}</div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${user.plan === 'pro' || user.plan === 'lifetime' ? 'bg-indigo-100 text-indigo-700' : 'bg-zinc-100 text-zinc-600'}`}>
                                                            {user.plan}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-zinc-500">
                                                        {user.expiresAt ? new Date(user.expiresAt).toLocaleDateString() : '-'}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {user.isAutoRenew ? <CheckCircle size={16} className="text-green-500" /> : <div className="w-4 h-4 rounded-full border border-zinc-300"></div>}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex gap-2">
                                                            <button onClick={() => setSelectedUser(user)} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold">Manage</button>
                                                            {user.plan !== 'free' && (
                                                                <button onClick={() => handleRevokePro(user.id)} className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded text-xs font-bold">Revoke</button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* FEATURES TAB */}
                    {activeTab === 'features' && (
                        <div className="grid grid-cols-12 gap-8">
                            {/* Sidebar */}
                            <div className="col-span-12 md:col-span-3 lg:col-span-2 space-y-1">
                                {SUB_TABS.map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setSettingsSubTab(tab.id)}
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${settingsSubTab === tab.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                                    >
                                        <tab.icon size={18} /> {tab.label}
                                    </button>
                                ))}
                            </div>

                            {/* Content */}
                            <div className="col-span-12 md:col-span-9 lg:col-span-10">
                                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
                                    <div className="flex justify-between items-center mb-6">
                                        <h2 className="text-xl font-bold flex items-center gap-2">
                                            {SUB_TABS.find(t => t.id === settingsSubTab)?.label} Settings
                                        </h2>
                                        <button 
                                            onClick={handleSaveConfig} 
                                            disabled={isSavingConfig}
                                            className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-green-500/20"
                                        >
                                            <Save size={18} /> {isSavingConfig ? 'Saving...' : 'Save Changes'}
                                        </button>
                                    </div>

                                    <div className="space-y-6">
                                        {CONFIG_GROUPS[settingsSubTab as keyof typeof CONFIG_GROUPS].map((key) => {
                                            const rule = config[key as keyof AppConfig] as FeatureRule;
                                            return (
                                                <div key={key} className="bg-zinc-50 dark:bg-zinc-950/50 rounded-xl p-5 border border-zinc-100 dark:border-zinc-800/50 hover:border-indigo-500/30 transition-colors">
                                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                                                        <div>
                                                            <h3 className="font-bold text-zinc-800 dark:text-zinc-200 text-sm md:text-base">{FEATURE_DESCRIPTIONS[key as keyof AppConfig] || key}</h3>
                                                            <code className="text-xs text-zinc-400 font-mono mt-1 block">{key}</code>
                                                        </div>
                                                        <div className="flex items-center gap-4 bg-white dark:bg-zinc-900 p-2 rounded-lg border border-zinc-200 dark:border-zinc-800">
                                                            <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                                                                <input type="checkbox" checked={rule.enabledForFree} onChange={(e) => handleConfigChange(key as any, 'enabledForFree', e.target.checked)} className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500" />
                                                                <span className={rule.enabledForFree ? 'text-green-600' : 'text-zinc-400'}>FREE</span>
                                                            </label>
                                                            <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700"></div>
                                                            <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                                                                <input type="checkbox" checked={rule.enabledForPro} onChange={(e) => handleConfigChange(key as any, 'enabledForPro', e.target.checked)} className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500" />
                                                                <span className={rule.enabledForPro ? 'text-indigo-600' : 'text-zinc-400'}>PRO</span>
                                                            </label>
                                                        </div>
                                                    </div>
                                                    
                                                    {/* LIMITS INPUTS */}
                                                    {(rule.limitFree !== undefined || rule.limitPro !== undefined) && (
                                                        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                                                            <div>
                                                                <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Free Limit</label>
                                                                <input 
                                                                    type="number" 
                                                                    value={rule.limitFree} 
                                                                    onChange={(e) => handleConfigChange(key as any, 'limitFree', parseInt(e.target.value))}
                                                                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded px-3 py-1.5 text-sm font-mono focus:border-indigo-500 outline-none"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Pro Limit</label>
                                                                <input 
                                                                    type="number" 
                                                                    value={rule.limitPro} 
                                                                    onChange={(e) => handleConfigChange(key as any, 'limitPro', parseInt(e.target.value))}
                                                                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded px-3 py-1.5 text-sm font-mono focus:border-indigo-500 outline-none"
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PAYMENTS TAB */}
                    {activeTab === 'payments' && (
                        <div>
                            {/* Provider Config */}
                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 mb-8 shadow-sm">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-xl font-bold flex items-center gap-2">
                                        <CreditCard className="text-indigo-500" /> Payment Provider
                                    </h2>
                                    <button onClick={handleSavePaymentConfig} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl font-bold text-sm shadow-lg shadow-indigo-500/20">
                                        <Save size={16} /> Save Keys
                                    </button>
                                </div>
                                <div className="grid md:grid-cols-2 gap-8">
                                    {/* Active Provider Selector */}
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold uppercase text-zinc-500 mb-2">Active Gateway</label>
                                        <div className="flex gap-4">
                                            <label className={`flex-1 border rounded-xl p-4 cursor-pointer transition-all ${paymentConfig.activeProvider === 'yookassa' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-zinc-200 dark:border-zinc-800'}`}>
                                                <input type="radio" name="provider" value="yookassa" checked={paymentConfig.activeProvider === 'yookassa'} onChange={() => setPaymentConfig(p => ({...p, activeProvider: 'yookassa'}))} className="sr-only"/>
                                                <div className="font-bold mb-1">YooKassa (Autopay)</div>
                                                <div className="text-xs text-zinc-500">Supports recurrent payments (subscriptions).</div>
                                            </label>
                                            <label className={`flex-1 border rounded-xl p-4 cursor-pointer transition-all ${paymentConfig.activeProvider === 'prodamus' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-zinc-200 dark:border-zinc-800'}`}>
                                                <input type="radio" name="provider" value="prodamus" checked={paymentConfig.activeProvider === 'prodamus'} onChange={() => setPaymentConfig(p => ({...p, activeProvider: 'prodamus'}))} className="sr-only"/>
                                                <div className="font-bold mb-1">Prodamus</div>
                                                <div className="text-xs text-zinc-500">Simple payment links. Good for global cards.</div>
                                            </label>
                                        </div>
                                    </div>

                                    {/* YooKassa Keys */}
                                    <div className={`space-y-4 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800/50 ${paymentConfig.activeProvider !== 'yookassa' ? 'opacity-50' : ''}`}>
                                        <h3 className="font-bold text-sm">YooKassa API</h3>
                                        <div>
                                            <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Shop ID</label>
                                            <input type="text" value={paymentConfig.yookassa.shopId} onChange={e => setPaymentConfig(p => ({...p, yookassa: {...p.yookassa, shopId: e.target.value}}))} className="w-full bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded px-3 py-2 text-sm font-mono"/>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Secret Key</label>
                                            <input type="password" value={paymentConfig.yookassa.secretKey} onChange={e => setPaymentConfig(p => ({...p, yookassa: {...p.yookassa, secretKey: e.target.value}}))} className="w-full bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded px-3 py-2 text-sm font-mono"/>
                                        </div>
                                    </div>

                                    {/* Prodamus Keys */}
                                    <div className={`space-y-4 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800/50 ${paymentConfig.activeProvider !== 'prodamus' ? 'opacity-50' : ''}`}>
                                        <h3 className="font-bold text-sm">Prodamus</h3>
                                        <div>
                                            <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Payment Page URL</label>
                                            <input type="text" value={paymentConfig.prodamus.url} onChange={e => setPaymentConfig(p => ({...p, prodamus: {...p.prodamus, url: e.target.value}}))} placeholder="https://demo.payform.ru" className="w-full bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded px-3 py-2 text-sm font-mono"/>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Secret Key</label>
                                            <input type="password" value={paymentConfig.prodamus.secretKey} onChange={e => setPaymentConfig(p => ({...p, prodamus: {...p.prodamus, secretKey: e.target.value}}))} className="w-full bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded px-3 py-2 text-sm font-mono"/>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Plan Builder (Drag & Drop) */}
                            <div>
                                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                                    <Layout className="text-indigo-500" /> Plan Builder
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                                    {paymentConfig.planOrder.map((planKey, idx) => (
                                        renderPlanEditor(planKey, idx)
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STRATEGY TAB (DASHBOARD) */}
                    {activeTab === 'strategy' && (
                        <div className="space-y-8">
                            {/* Goals */}
                            <div className="grid grid-cols-4 gap-6">
                                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
                                    <div className="text-zinc-500 text-xs font-bold uppercase mb-2">Цель (Phase 1)</div>
                                    <div className="text-3xl font-bold text-white mb-1">150</div>
                                    <div className="text-sm text-zinc-400">Лицензий Lifetime</div>
                                </div>
                                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
                                    <div className="text-zinc-500 text-xs font-bold uppercase mb-2">Выручка</div>
                                    <div className="text-3xl font-bold text-green-400 mb-1">435k ₽</div>
                                    <div className="text-sm text-zinc-400">Target (150 * 2900)</div>
                                </div>
                                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
                                    <div className="text-zinc-500 text-xs font-bold uppercase mb-2">Churn Rate</div>
                                    <div className="text-3xl font-bold text-indigo-400 mb-1">0%</div>
                                    <div className="text-sm text-zinc-400">Lifetime = No Churn</div>
                                </div>
                                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
                                    <div className="text-zinc-500 text-xs font-bold uppercase mb-2">Runway</div>
                                    <div className="text-3xl font-bold text-white mb-1">∞</div>
                                    <div className="text-sm text-zinc-400">Self-Funded</div>
                                </div>
                            </div>

                            {/* Roadmap Timeline */}
                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8">
                                <h3 className="font-bold text-lg mb-6">Execution Plan</h3>
                                <div className="relative">
                                    <div className="absolute top-1/2 left-0 right-0 h-1 bg-zinc-100 dark:bg-zinc-800 -translate-y-1/2 rounded-full"></div>
                                    <div className="grid grid-cols-3 gap-4 relative z-10">
                                        <div className="text-center">
                                            <div className="w-4 h-4 bg-green-500 rounded-full mx-auto mb-4 border-4 border-white dark:border-zinc-900 box-content"></div>
                                            <div className="font-bold text-sm">Month 1-3</div>
                                            <div className="text-xs text-zinc-500 mt-1">Infrastructure & Core Features</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="w-4 h-4 bg-indigo-500 rounded-full mx-auto mb-4 border-4 border-white dark:border-zinc-900 box-content"></div>
                                            <div className="font-bold text-sm">Month 4-6</div>
                                            <div className="text-xs text-zinc-500 mt-1">Marketing & First 100 Sales</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="w-4 h-4 bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto mb-4 border-4 border-white dark:border-zinc-900 box-content"></div>
                                            <div className="font-bold text-sm">Month 7+</div>
                                            <div className="text-xs text-zinc-500 mt-1">SaaS Transition (Monthly)</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Growth Hacking */}
                            <div className="grid grid-cols-2 gap-6">
                                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
                                    <h3 className="font-bold mb-4 flex items-center gap-2"><Target size={18} className="text-red-500"/> Channels</h3>
                                    <ul className="space-y-3 text-sm text-zinc-400">
                                        <li className="flex items-center gap-2"><CheckCircle size={14} className="text-green-500"/> Telegram Communities (Filmmakers)</li>
                                        <li className="flex items-center gap-2"><Circle size={14}/> Direct Sales (Studios)</li>
                                        <li className="flex items-center gap-2"><Circle size={14}/> YouTube Integration (Reviews)</li>
                                    </ul>
                                </div>
                                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
                                    <h3 className="font-bold mb-4 flex items-center gap-2"><Lightbulb size={18} className="text-yellow-500"/> Features Pipeline</h3>
                                    <ul className="space-y-3 text-sm text-zinc-400">
                                        <li className="flex items-center gap-2"><CheckCircle size={14} className="text-green-500"/> DaVinci XML Export</li>
                                        <li className="flex items-center gap-2"><CheckCircle size={14} className="text-green-500"/> Cloud S3 Integration</li>
                                        <li className="flex items-center gap-2"><Circle size={14}/> AI Transcription V2 (Diarization)</li>
                                        <li className="flex items-center gap-2"><Circle size={14}/> Mobile App (PWA+)</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* GRANT MODAL */}
            {selectedUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl relative">
                        <button onClick={() => setSelectedUser(null)} className="absolute top-4 right-4 text-zinc-400 hover:text-white"><X size={20} /></button>
                        <h3 className="text-lg font-bold mb-4">Grant Pro Status</h3>
                        <p className="text-sm text-zinc-500 mb-4">User: <strong>{selectedUser.name}</strong></p>
                        
                        <div className="space-y-3 mb-6">
                            <label className="block text-xs font-bold uppercase text-zinc-500">Duration</label>
                            <div className="grid grid-cols-3 gap-2">
                                <button onClick={() => setGrantDuration(30)} className={`py-2 rounded-lg text-xs font-bold border ${grantDuration === 30 ? 'bg-indigo-600 text-white border-indigo-600' : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800'}`}>30 Days</button>
                                <button onClick={() => setGrantDuration(365)} className={`py-2 rounded-lg text-xs font-bold border ${grantDuration === 365 ? 'bg-indigo-600 text-white border-indigo-600' : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800'}`}>1 Year</button>
                                <button onClick={() => setGrantDuration(0)} className={`py-2 rounded-lg text-xs font-bold border ${grantDuration === 0 ? 'bg-green-600 text-white border-green-600' : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800'}`}>Lifetime</button>
                            </div>
                        </div>

                        <button 
                            onClick={handleGrantPro} 
                            disabled={isGranting}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                        >
                            <Crown size={16} /> Grant Access
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
