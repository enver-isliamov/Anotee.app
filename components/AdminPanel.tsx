
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
                            <button onClick={() => addFeature(planKey as any)} className="w-full py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-lg text-xs font-bold hover:text-indigo-500 flex items-