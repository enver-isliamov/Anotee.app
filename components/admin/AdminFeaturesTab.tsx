
import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { AppConfig, DEFAULT_CONFIG, FeatureRule } from '../../types';
import { useAppVersion } from '../../hooks/useAppVersion';
import { RefreshCw, Save, AlertTriangle, Sliders, Users, Download, Sparkles, Layout, Database, Lock, SplitSquareHorizontal, HardDrive, FileJson, FileSpreadsheet, Monitor, Globe, Mic, HelpCircle, Link as LinkIcon, Power, Check, X, Infinity, Tag } from 'lucide-react';

interface FeatureMeta {
    title: string;
    description: string;
    location: string;
    icon: any;
}

const FEATURE_METADATA: Record<keyof AppConfig, FeatureMeta> = {
    // General
    max_projects: {
        title: "Лимиты проектов",
        description: "Количество активных личных проектов.",
        location: "Core",
        icon: Database
    },
    project_locking: {
        title: "Блокировка (NDA)",
        description: "Запрет изменений и шеринга проекта.",
        location: "Проект",
        icon: Lock
    },
    version_comparison: {
        title: "Сравнение версий",
        description: "Режим Side-by-Side плеера.",
        location: "Плеер",
        icon: SplitSquareHorizontal
    },
    local_file_link: {
        title: "Локальный файл",
        description: "Просмотр офлайн без загрузки в облако.",
        location: "Плеер",
        icon: HardDrive
    },

    // Sharing
    sharing_project: {
        title: "Приглашение в команду",
        description: "Добавление редакторов по email.",
        location: "Share Modal",
        icon: Users
    },
    sharing_public_link: {
        title: "Публичные ссылки",
        description: "Просмотр без регистрации (Review Link).",
        location: "Share Modal",
        icon: Globe
    },

    // Export
    export_xml: {
        title: "Экспорт Resolve (XML)",
        description: "Скачивание цветных маркеров .xml.",
        location: "Экспорт",
        icon: FileJson
    },
    export_csv: {
        title: "Экспорт Premiere (CSV)",
        description: "Скачивание таблицы маркеров .csv.",
        location: "Экспорт",
        icon: FileSpreadsheet
    },

    // Cloud & AI
    google_drive: {
        title: "Google Drive",
        description: "Интеграция личного диска.",
        location: "Профиль",
        icon: HardDrive
    },
    high_res_proxies: {
        title: "4K / Оригиналы",
        description: "Хранение исходников высокого качества.",
        location: "Плеер",
        icon: Monitor
    },
    s3_custom_domain: {
        title: "White Label (CDN)",
        description: "Свой домен для раздачи файлов.",
        location: "S3 Config",
        icon: Globe
    },
    ai_transcription: {
        title: "AI Транскрибация",
        description: "Перевод речи в текст (Whisper).",
        location: "Плеер",
        icon: Mic
    },

    // UI Elements
    ui_upsell_banner: {
        title: "Баннер 'Купить Pro'",
        description: "Рекламный блок в дашборде.",
        location: "Дашборд",
        icon: Sparkles
    },
    ui_roadmap_block: {
        title: "Блок Тарифов",
        description: "Секция цен и покупки.",
        location: "Профиль",
        icon: Layout
    },
    ui_help_button: {
        title: "Кнопка 'Тур'",
        description: "Запуск онбординга.",
        location: "Хедер",
        icon: HelpCircle
    },
    ui_footer: {
        title: "Футер",
        description: "Подвал сайта.",
        location: "Global",
        icon: Layout
    },
    ui_drive_connect: {
        title: "Кнопка Drive",
        description: "Призыв подключить диск.",
        location: "Профиль",
        icon: LinkIcon
    }
};

const CONFIG_GROUPS = {
    general: ['max_projects', 'project_locking', 'version_comparison', 'local_file_link'],
    sharing: ['sharing_project', 'sharing_public_link'],
    export: ['export_xml', 'export_csv'],
    cloud: ['google_drive', 'high_res_proxies', 's3_custom_domain', 'ai_transcription'],
    ui: ['ui_upsell_banner', 'ui_roadmap_block', 'ui_help_button', 'ui_footer', 'ui_drive_connect']
};

const SUB_TABS = [
    { id: 'general', label: 'Основные', icon: Sliders },
    { id: 'sharing', label: 'Доступ', icon: Users },
    { id: 'export', label: 'Экспорт', icon: Download },
    { id: 'cloud', label: 'AI и Облако', icon: Sparkles },
    { id: 'ui', label: 'Интерфейс', icon: Layout },
];

export const AdminFeaturesTab: React.FC = () => {
    const { getToken } = useAuth();
    const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
    const [configLoading, setConfigLoading] = useState(false);
    const [isSavingConfig, setIsSavingConfig] = useState(false);
    const [settingsSubTab, setSettingsSubTab] = useState('general');

    // Version Data
    const { version: fetchedVersion } = useAppVersion();
    const [appVersion, setAppVersion] = useState('');
    const [isSavingVersion, setIsSavingVersion] = useState(false);

    useEffect(() => {
        if (fetchedVersion) setAppVersion(fetchedVersion);
    }, [fetchedVersion]);

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

    useEffect(() => {
        fetchConfig();
    }, []);

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

    const handleSaveVersion = async () => {
        setIsSavingVersion(true);
        try {
            const token = await getToken();
            await fetch('/api/admin?action=update_version', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ version: appVersion })
            });
            alert("Версия обновлена!");
        } catch (e) {
            alert("Ошибка обновления версии");
        } finally {
            setIsSavingVersion(false);
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

    const renderConfigCard = (key: string, rule: FeatureRule) => {
        const meta = FEATURE_METADATA[key as keyof AppConfig] || { 
            title: key, 
            description: "No description", 
            location: "Unknown", 
            icon: Power 
        };
        const Icon = meta.icon;

        return (
            <div key={key} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm flex flex-col h-full hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
                
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-zinc-500 dark:text-zinc-400">
                            <Icon size={18} />
                        </div>
                        <div>
                            <h4 className="font-bold text-sm text-zinc-900 dark:text-white leading-tight">{meta.title}</h4>
                            <span className="text-[10px] text-zinc-400 font-mono bg-zinc-50 dark:bg-zinc-950 px-1.5 rounded">{meta.location}</span>
                        </div>
                    </div>
                </div>
                
                <p className="text-xs text-zinc-500 dark:text-zinc-500 mb-4 flex-1 leading-snug">
                    {meta.description}
                </p>

                {/* Toggles Grid (3 Columns now) */}
                <div className="grid grid-cols-3 gap-2 mt-auto">
                    
                    {/* FREE TIER */}
                    <div 
                        onClick={() => handleConfigChange(key as keyof AppConfig, 'enabledForFree', !rule.enabledForFree)}
                        className={`cursor-pointer rounded-lg p-2 border transition-all relative group select-none flex flex-col items-center justify-center text-center ${
                            rule.enabledForFree 
                                ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600' 
                                : 'bg-zinc-50 dark:bg-zinc-950/50 border-zinc-100 dark:border-zinc-900 opacity-60 grayscale'
                        }`}
                    >
                        <span className={`text-[9px] font-bold uppercase mb-1 ${rule.enabledForFree ? 'text-zinc-800 dark:text-zinc-200' : 'text-zinc-400'}`}>Free</span>
                        {rule.enabledForFree ? <Check size={12} className="text-zinc-600 dark:text-zinc-400"/> : <X size={12} className="text-zinc-300"/>}
                        
                        {rule.limitFree !== undefined && (
                            <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                                <input 
                                    type="number"
                                    className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-zinc-700 rounded px-1 py-0.5 text-[10px] font-mono text-center outline-none focus:border-zinc-400 h-5"
                                    value={rule.limitFree}
                                    onChange={(e) => handleConfigChange(key as keyof AppConfig, 'limitFree', parseInt(e.target.value))}
                                />
                            </div>
                        )}
                    </div>

                    {/* PRO TIER */}
                    <div 
                        onClick={() => handleConfigChange(key as keyof AppConfig, 'enabledForPro', !rule.enabledForPro)}
                        className={`cursor-pointer rounded-lg p-2 border transition-all relative group select-none flex flex-col items-center justify-center text-center ${
                            rule.enabledForPro 
                                ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-500/30' 
                                : 'bg-zinc-50 dark:bg-zinc-950/50 border-zinc-100 dark:border-zinc-900 opacity-60 grayscale'
                        }`}
                    >
                        <span className={`text-[9px] font-bold uppercase mb-1 ${rule.enabledForPro ? 'text-indigo-600 dark:text-indigo-300' : 'text-zinc-400'}`}>Pro</span>
                        {rule.enabledForPro ? <Check size={12} className="text-indigo-500"/> : <X size={12} className="text-zinc-300"/>}

                        {rule.limitPro !== undefined && (
                            <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                                <input 
                                    type="number"
                                    className="w-full bg-white dark:bg-black border border-indigo-100 dark:border-indigo-900/50 rounded px-1 py-0.5 text-[10px] font-mono text-center outline-none focus:border-indigo-500 text-indigo-900 dark:text-indigo-100 h-5"
                                    value={rule.limitPro}
                                    onChange={(e) => handleConfigChange(key as keyof AppConfig, 'limitPro', parseInt(e.target.value))}
                                />
                            </div>
                        )}
                    </div>

                    {/* LIFETIME TIER */}
                    <div 
                        onClick={() => handleConfigChange(key as keyof AppConfig, 'enabledForLifetime', !rule.enabledForLifetime)}
                        className={`cursor-pointer rounded-lg p-2 border transition-all relative group select-none flex flex-col items-center justify-center text-center ${
                            rule.enabledForLifetime 
                                ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-500/30' 
                                : 'bg-zinc-50 dark:bg-zinc-950/50 border-zinc-100 dark:border-zinc-900 opacity-60 grayscale'
                        }`}
                    >
                        <span className={`text-[9px] font-bold uppercase mb-1 ${rule.enabledForLifetime ? 'text-amber-600 dark:text-amber-300' : 'text-zinc-400'}`}>Life</span>
                        {rule.enabledForLifetime ? <Check size={12} className="text-amber-500"/> : <X size={12} className="text-zinc-300"/>}

                        {rule.limitLifetime !== undefined && (
                            <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                                <input 
                                    type="number"
                                    className="w-full bg-white dark:bg-black border border-amber-100 dark:border-amber-900/50 rounded px-1 py-0.5 text-[10px] font-mono text-center outline-none focus:border-amber-500 text-amber-900 dark:text-amber-100 h-5"
                                    value={rule.limitLifetime}
                                    onChange={(e) => handleConfigChange(key as keyof AppConfig, 'limitLifetime', parseInt(e.target.value))}
                                />
                            </div>
                        )}
                    </div>

                </div>
            </div>
        );
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 pb-20">
            
            {/* APP VERSION CONTROL */}
            <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl mb-8 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white dark:bg-black rounded-lg shadow-sm">
                        <Tag className="text-indigo-500" size={18} />
                    </div>
                    <div>
                        <h3 className="text-xs font-bold uppercase text-zinc-600 dark:text-zinc-400">Версия Приложения</h3>
                        <p className="text-[10px] text-zinc-500">Отображается на главной странице и в логах</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <input 
                        value={appVersion}
                        onChange={(e) => setAppVersion(e.target.value)}
                        className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono w-32 md:w-40 text-center outline-none focus:border-indigo-500"
                        placeholder="v1.0.0"
                    />
                    <button 
                        onClick={handleSaveVersion}
                        disabled={isSavingVersion}
                        className="px-4 py-2 bg-zinc-900 dark:bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-bold disabled:opacity-50 transition-colors shadow-sm"
                    >
                        {isSavingVersion ? <RefreshCw size={16} className="animate-spin"/> : 'Обновить'}
                    </button>
                </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-6 sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-md py-4 z-10 -mx-4 px-4 border-b border-zinc-100 dark:border-zinc-800">
                {SUB_TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setSettingsSubTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${settingsSubTab === tab.id 
                            ? 'bg-zinc-900 dark:bg-zinc-800 text-white border-zinc-900 dark:border-zinc-700 shadow-md transform scale-105' 
                            : 'bg-white dark:bg-zinc-900 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                        }`}
                    >
                        <tab.icon size={14} />
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
                {CONFIG_GROUPS[settingsSubTab as keyof typeof CONFIG_GROUPS].map((key) => renderConfigCard(key, config[key as keyof AppConfig]))}
            </div>

            <div className="mt-12 flex justify-end sticky bottom-6 z-20 pointer-events-none">
                <button 
                    onClick={handleSaveConfig}
                    disabled={isSavingConfig || configLoading}
                    className="pointer-events-auto flex items-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full text-base font-bold shadow-2xl shadow-indigo-500/40 transition-all disabled:opacity-50 active:scale-95 border border-indigo-400/20"
                >
                    {isSavingConfig ? <RefreshCw size={20} className="animate-spin" /> : <Save size={20} />}
                    Сохранить изменения
                </button>
            </div>
        </div>
    );
};
