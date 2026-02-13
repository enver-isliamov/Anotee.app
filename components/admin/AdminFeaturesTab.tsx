
import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { AppConfig, DEFAULT_CONFIG, FeatureRule } from '../../types';
import { useAppVersion } from '../../hooks/useAppVersion';
import { RefreshCw, Save, AlertTriangle, Sliders, Users, Download, Sparkles, Layout, Tag, Globe } from 'lucide-react';

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
    s3_custom_domain: "White Label (Custom Domain / CDN)",
    
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
    cloud: ['google_drive', 'high_res_proxies', 's3_custom_domain', 'ai_transcription'],
    ui: ['ui_upsell_banner', 'ui_roadmap_block', 'ui_help_button', 'ui_footer', 'ui_drive_connect']
};

const SUB_TABS = [
    { id: 'general', label: 'Основные', icon: Sliders },
    { id: 'sharing', label: 'Доступ и Шеринг', icon: Users },
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

    const renderConfigRow = (key: string, rule: FeatureRule) => {
        return (
            <div key={key} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl flex flex-col gap-3">
                <div className="flex justify-between items-start">
                    <div>
                        <h4 className="font-bold text-sm text-zinc-900 dark:text-white">
                            {FEATURE_DESCRIPTIONS[key as keyof AppConfig] || key}
                        </h4>
                        <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{key}</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    {/* Free Tier */}
                    <div>
                        <div className="text-[10px] uppercase font-bold text-zinc-500 mb-2">Free Tier</div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-zinc-600 dark:text-zinc-400">Enabled</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={rule.enabledForFree}
                                    onChange={(e) => handleConfigChange(key as keyof AppConfig, 'enabledForFree', e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>
                        {rule.limitFree !== undefined && (
                            <div>
                                <label className="text-[10px] text-zinc-500 block mb-1">Limit</label>
                                <input
                                    type="number"
                                    value={rule.limitFree}
                                    onChange={(e) => handleConfigChange(key as keyof AppConfig, 'limitFree', parseInt(e.target.value))}
                                    className="w-full bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 text-xs font-mono"
                                />
                            </div>
                        )}
                    </div>

                    {/* Pro Tier */}
                    <div className="pl-4 border-l border-zinc-100 dark:border-zinc-800">
                        <div className="text-[10px] uppercase font-bold text-indigo-500 mb-2">Pro Tier</div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-zinc-600 dark:text-zinc-400">Enabled</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={rule.enabledForPro}
                                    onChange={(e) => handleConfigChange(key as keyof AppConfig, 'enabledForPro', e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>
                        {rule.limitPro !== undefined && (
                            <div>
                                <label className="text-[10px] text-zinc-500 block mb-1">Limit</label>
                                <input
                                    type="number"
                                    value={rule.limitPro}
                                    onChange={(e) => handleConfigChange(key as keyof AppConfig, 'limitPro', parseInt(e.target.value))}
                                    className="w-full bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 text-xs font-mono"
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            
            {/* APP VERSION CONTROL */}
            <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Tag className="text-indigo-500" size={18} />
                    <div>
                        <h3 className="text-xs font-bold uppercase text-zinc-600 dark:text-zinc-400">App Version</h3>
                        <p className="text-[10px] text-zinc-500">Отображается на главной странице и в логах</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <input 
                        value={appVersion}
                        onChange={(e) => setAppVersion(e.target.value)}
                        className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono w-40"
                        placeholder="v1.0.0"
                    />
                    <button 
                        onClick={handleSaveVersion}
                        disabled={isSavingVersion}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold disabled:opacity-50"
                    >
                        {isSavingVersion ? '...' : 'Save'}
                    </button>
                </div>
            </div>

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
                {CONFIG_GROUPS[settingsSubTab as keyof typeof CONFIG_GROUPS].map((key) => renderConfigRow(key, config[key as keyof AppConfig]))}
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
    );
};
