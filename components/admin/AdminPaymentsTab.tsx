
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { PaymentConfig, DEFAULT_PAYMENT_CONFIG, PlanConfig, PlanFeature } from '../../types';
import { RefreshCw, CreditCard, CheckCircle, ExternalLink, Edit3, GripVertical, Zap, X, Plus, Save, Key, Edit2, Check, Lock, Unlock, Hash, Link as LinkIcon, Eye, EyeOff } from 'lucide-react';

// --- HELPER COMPONENTS ---

const LockedConfigInput = ({ 
    label, 
    value, 
    onChange, 
    placeholder, 
    icon: Icon,
    type = "text"
}: { 
    label: string, 
    value: string, 
    onChange: (val: string) => void, 
    placeholder?: string,
    icon: any,
    type?: string
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isEditing]);

    return (
        <div className="w-full">
            <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1.5">{label}</label>
            <div className="relative group">
                <div className={`absolute left-3 top-2.5 transition-colors ${isEditing ? 'text-indigo-500' : 'text-zinc-400'}`}>
                    <Icon size={16} />
                </div>
                <input
                    ref={inputRef}
                    type={type}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    readOnly={!isEditing}
                    placeholder={placeholder}
                    className={`w-full rounded-xl py-2.5 pl-10 pr-10 text-sm font-mono outline-none border transition-all ${
                        isEditing 
                            ? 'bg-white dark:bg-black border-indigo-500 text-zinc-900 dark:text-zinc-100 shadow-[0_0_0_2px_rgba(99,102,241,0.1)]' 
                            : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 cursor-default opacity-80'
                    }`}
                />
                <button 
                    onClick={() => setIsEditing(!isEditing)}
                    className={`absolute right-2 top-2 p-1 rounded-lg transition-all ${
                        isEditing 
                            ? 'text-white bg-indigo-500 hover:bg-indigo-600 shadow-sm' 
                            : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                    }`}
                    title={isEditing ? "Done" : "Edit"}
                >
                    {isEditing ? <Check size={14} /> : <Edit2 size={14} />}
                </button>
            </div>
        </div>
    );
};

const LockedSecretInput = ({ 
    label, 
    value, 
    onChange, 
    placeholder 
}: { 
    label: string, 
    value: string, 
    onChange: (val: string) => void, 
    placeholder?: string 
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [showSecret, setShowSecret] = useState(false);
    
    // Mask logic
    const isSet = value && value !== '' && value !== '********';
    const displayValue = isEditing ? value : (value ? '••••••••••••••••••••••••' : '');

    const handleToggle = () => {
        if (!isEditing) {
            // Enter edit mode: Clear if it was masked default '********' to allow fresh entry
            if (value === '********') onChange('');
            setIsEditing(true);
        } else {
            // Save/Lock
            setIsEditing(false);
            setShowSecret(false);
        }
    };

    return (
        <div className="w-full">
             <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1.5">{label}</label>
             <div className="relative group">
                <div className={`absolute left-3 top-2.5 transition-colors ${isEditing ? 'text-indigo-500' : 'text-zinc-400'}`}>
                    <Key size={16} />
                </div>
                <input
                    type={isEditing && showSecret ? "text" : "password"}
                    value={displayValue}
                    onChange={(e) => onChange(e.target.value)}
                    readOnly={!isEditing}
                    placeholder={isEditing ? placeholder : (value ? "Configured" : "Not Configured")}
                    className={`w-full rounded-xl py-2.5 pl-10 pr-20 text-sm font-mono outline-none border transition-all ${
                        isEditing 
                            ? 'bg-white dark:bg-black border-indigo-500 text-zinc-900 dark:text-zinc-100 shadow-[0_0_0_2px_rgba(99,102,241,0.1)]' 
                            : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 cursor-default opacity-80'
                    }`}
                />
                
                <div className="absolute right-2 top-2 flex gap-1">
                    {isEditing && (
                        <button 
                            onClick={() => setShowSecret(!showSecret)}
                            className="p-1 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                        >
                            {showSecret ? <EyeOff size={14}/> : <Eye size={14}/>}
                        </button>
                    )}
                    <button 
                        onClick={handleToggle}
                        className={`p-1 rounded-lg transition-all ${
                            isEditing 
                                ? 'text-white bg-indigo-500 hover:bg-indigo-600 shadow-sm' 
                                : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                        }`}
                        title={isEditing ? "Done" : "Change Secret"}
                    >
                        {isEditing ? <Check size={14} /> : <Edit2 size={14} />}
                    </button>
                </div>
             </div>
        </div>
    )
}

// --- MAIN COMPONENT ---

export const AdminPaymentsTab: React.FC = () => {
    const { getToken } = useAuth();
    const [paymentConfig, setPaymentConfig] = useState<PaymentConfig>(DEFAULT_PAYMENT_CONFIG);
    const [paymentLoading, setPaymentLoading] = useState(false);
    const [isSavingPayment, setIsSavingPayment] = useState(false);

    // UI States
    const [isEditingGateway, setIsEditingGateway] = useState(false);

    // Drag and Drop Refs
    const dragItem = useRef<{ type: 'PLAN' | 'FEATURE', index: number, parentId?: string } | null>(null);

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
        fetchPaymentConfig();
    }, []);

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
            setIsEditingGateway(false); // Lock gateway selection after save
        } catch (e) {
            alert("Не удалось сохранить настройки платежей");
        } finally {
            setIsSavingPayment(false);
        }
    };

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
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 w-full mx-auto pb-24">
            <div className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-500/20 p-6 rounded-2xl mb-8 text-center">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Настройка Платежей</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Управление шлюзами и тарифными планами.</p>
            </div>

            {paymentLoading ? (
                <div className="flex justify-center p-12"><RefreshCw className="animate-spin text-zinc-400" /></div>
            ) : (
                <div className="flex flex-col gap-8">
                    
                    {/* BLOCK 1: GATEWAY SELECTION */}
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
                        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4 mb-6">
                            <h3 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                                <CreditCard size={18}/> Выбор Шлюза (Gateway)
                            </h3>
                            <button 
                                onClick={() => setIsEditingGateway(!isEditingGateway)} 
                                className={`p-2 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold ${isEditingGateway ? 'bg-indigo-600 text-white shadow-lg' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}
                            >
                                {isEditingGateway ? (
                                    <> <Check size={14} /> Готово </>
                                ) : (
                                    <> <Edit2 size={14} /> Изменить </>
                                )}
                            </button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <button 
                                onClick={() => isEditingGateway && setPaymentConfig(prev => ({...prev, activeProvider: 'yookassa'}))}
                                disabled={!isEditingGateway}
                                className={`relative p-4 rounded-xl border-2 transition-all text-left flex items-center gap-4 group 
                                    ${paymentConfig.activeProvider === 'yookassa' 
                                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
                                        : 'border-zinc-200 dark:border-zinc-800'
                                    }
                                    ${!isEditingGateway && paymentConfig.activeProvider !== 'yookassa' ? 'opacity-50 grayscale cursor-default' : ''}
                                    ${!isEditingGateway && paymentConfig.activeProvider === 'yookassa' ? 'cursor-default' : ''}
                                    ${isEditingGateway ? 'hover:border-zinc-300 dark:hover:border-zinc-700 cursor-pointer' : ''}
                                `}
                            >
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg text-white ${paymentConfig.activeProvider === 'yookassa' ? 'bg-[#7B61FF]' : 'bg-zinc-300 dark:bg-zinc-700'}`}>Yoo</div>
                                <div>
                                    <div className="font-bold text-zinc-900 dark:text-white">ЮKassa</div>
                                    <div className="text-xs text-zinc-500">Автоплатежи (Recurrent)</div>
                                </div>
                                {paymentConfig.activeProvider === 'yookassa' && <div className="absolute top-4 right-4 text-indigo-500"><CheckCircle size={20} /></div>}
                                {!isEditingGateway && paymentConfig.activeProvider !== 'yookassa' && <div className="absolute top-4 right-4 text-zinc-300"><Lock size={16} /></div>}
                            </button>

                            <button 
                                onClick={() => isEditingGateway && setPaymentConfig(prev => ({...prev, activeProvider: 'prodamus'}))}
                                disabled={!isEditingGateway}
                                className={`relative p-4 rounded-xl border-2 transition-all text-left flex items-center gap-4 group 
                                    ${paymentConfig.activeProvider === 'prodamus' 
                                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
                                        : 'border-zinc-200 dark:border-zinc-800'
                                    }
                                    ${!isEditingGateway && paymentConfig.activeProvider !== 'prodamus' ? 'opacity-50 grayscale cursor-default' : ''}
                                    ${!isEditingGateway && paymentConfig.activeProvider === 'prodamus' ? 'cursor-default' : ''}
                                    ${isEditingGateway ? 'hover:border-zinc-300 dark:hover:border-zinc-700 cursor-pointer' : ''}
                                `}
                            >
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg text-white ${paymentConfig.activeProvider === 'prodamus' ? 'bg-orange-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}>Pr</div>
                                <div>
                                    <div className="font-bold text-zinc-900 dark:text-white">Prodamus</div>
                                    <div className="text-xs text-zinc-500">Международные карты</div>
                                </div>
                                {paymentConfig.activeProvider === 'prodamus' && <div className="absolute top-4 right-4 text-indigo-500"><CheckCircle size={20} /></div>}
                                {!isEditingGateway && paymentConfig.activeProvider !== 'prodamus' && <div className="absolute top-4 right-4 text-zinc-300"><Lock size={16} /></div>}
                            </button>
                        </div>

                        {/* Settings Fields */}
                        <div className="bg-zinc-50 dark:bg-zinc-950 rounded-xl p-4 border border-zinc-200 dark:border-zinc-800 animate-in fade-in">
                            {paymentConfig.activeProvider === 'yookassa' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <LockedConfigInput 
                                        label="Shop ID" 
                                        value={paymentConfig.yookassa.shopId} 
                                        onChange={(val) => setPaymentConfig(prev => ({...prev, yookassa: {...prev.yookassa, shopId: val}}))}
                                        placeholder="Enter Shop ID"
                                        icon={Hash}
                                    />
                                    <LockedSecretInput
                                        label="Secret Key"
                                        value={paymentConfig.yookassa.secretKey}
                                        onChange={(val) => setPaymentConfig(prev => ({...prev, yookassa: {...prev.yookassa, secretKey: val}}))}
                                        placeholder="Enter New Secret Key"
                                    />
                                </div>
                            )}

                            {paymentConfig.activeProvider === 'prodamus' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <LockedConfigInput 
                                        label="Payment Page URL" 
                                        value={paymentConfig.prodamus.url} 
                                        onChange={(val) => setPaymentConfig(prev => ({...prev, prodamus: {...prev.prodamus, url: val}}))}
                                        placeholder="https://yourschool.payform.ru"
                                        icon={LinkIcon}
                                    />
                                    <LockedSecretInput
                                        label="Secret Key (Signing)"
                                        value={paymentConfig.prodamus.secretKey}
                                        onChange={(val) => setPaymentConfig(prev => ({...prev, prodamus: {...prev.prodamus, secretKey: val}}))}
                                        placeholder="Enter Signing Secret"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* BLOCK 2: PLAN EDITOR (HORIZONTAL GRID) */}
                    <div>
                        <h3 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-6">
                            <Edit3 size={18}/> Редактор Тарифов
                        </h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                            {paymentConfig.planOrder.map((planKey, index) => 
                                renderPlanEditor(planKey, index)
                            )}
                        </div>
                    </div>

                    <div className="fixed bottom-6 right-6 z-50">
                        <button 
                            onClick={handleSavePaymentConfig}
                            disabled={isSavingPayment}
                            className="flex items-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full text-base font-bold shadow-2xl shadow-indigo-500/40 transition-all disabled:opacity-50 active:scale-95 border border-indigo-400/20"
                        >
                            {isSavingPayment ? <RefreshCw size={20} className="animate-spin" /> : <Save size={20} />}
                            Сохранить Настройки
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
