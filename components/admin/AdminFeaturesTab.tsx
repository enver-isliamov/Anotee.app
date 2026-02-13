
import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { AppConfig, DEFAULT_CONFIG, FeatureRule } from '../../types';
import { useAppVersion } from '../../hooks/useAppVersion';
import { RefreshCw, Save, AlertTriangle, Sliders, Users, Download, Sparkles, Layout, Tag, Database, Lock, SplitSquareHorizontal, HardDrive, FileJson, FileSpreadsheet, Monitor, Globe, Image, Mic, MessageSquare, HelpCircle, Link as LinkIcon, Power } from 'lucide-react';

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
        description: "Ограничение на количество активных личных проектов, которые может создать пользователь.",
        location: "Дашборд / API",
        icon: Database
    },
    project_locking: {
        title: "Блокировка Проекта (NDA)",
        description: "Возможность закрывать проект от изменений и шеринга (Lock Mode).",
        location: "Карточка проекта",
        icon: Lock
    },
    version_comparison: {
        title: "Сравнение версий",
        description: "Режим Side-by-Side для одновременного просмотра двух версий видео.",
        location: "Плеер (Header)",
        icon: SplitSquareHorizontal
    },
    local_file_link: {
        title: "Локальный файл (Offline)",
        description: "Возможность привязать локальный файл с диска для просмотра без интернета.",
        location: "Плеер (Header)",
        icon: HardDrive
    },

    // Sharing
    sharing_project: {
        title: "Приглашение в команду",
        description: "Отправка инвайтов по email для добавления редакторов в проект.",
        location: "Модальное окно Share",
        icon: Users
    },
    sharing_public_link: {
        title: "Публичные ссылки",
        description: "Генерация ссылок для просмотра без регистрации (Client Review).",
        location: "Модальное окно Share",
        icon: Globe
    },

    // Export
    export_xml: {
        title: "Экспорт в DaVinci Resolve",
        description: "Скачивание маркеров в формате .xml (FCP7 XML).",
        location: "Плеер (Меню Экспорта)",
        icon: FileJson
    },
    export_csv: {
        title: "Экспорт в Premiere Pro",
        description: "Скачивание списка комментариев в табличном формате .csv.",
        location: "Плеер (Меню Экспорта)",
        icon: FileSpreadsheet
    },

    // Cloud & AI
    google_drive: {
        title: "Google Drive Интеграция",
        description: "Возможность подключить личный Google Диск для хранения исходников.",
        location: "Профиль / Загрузка",
        icon: HardDrive
    },
    high_res_proxies: {
        title: "4K / Оригиналы",
        description: "Разрешить просмотр и хранение файлов высокого разрешения.",
        location: "Плеер",
        icon: Monitor
    },
    s3_custom_domain: {
        title: "White Label (CDN)",
        description: "Подключение своего домена для раздачи файлов через S3.",
        location: "Профиль (Настройки S3)",
        icon: Globe
    },
    ai_transcription: {
        title: "AI Транскрибация",
        description: "Автоматический перевод речи в текст (Whisper) прямо в браузере.",
        location: "Плеер (Сайдбар)",
        icon: Mic
    },

    // UI Elements
    ui_upsell_banner: {
        title: "Баннер 'Купить Pro'",
        description: "Рекламный блок с призывом обновиться до платной версии.",
        location: "Дашборд (Низ)",
        icon: Sparkles
    },
    ui_roadmap_block: {
        title: "Блок Тарифов (Roadmap)",
        description: "Секция с карточками тарифов и кнопками покупки.",
        location: "Профиль / Страница Цен",
        icon: Layout
    },
    ui_help_button: {
        title: "Кнопка 'Тур/Помощь'",
        description: "Иконка знака вопроса для запуска онбординг-тура.",
        location: "Хедер (Верхнее меню)",
        icon: HelpCircle
    },
    ui_footer: {
        title: "Футер приложения",
        description: "Нижняя часть сайта с ссылками на оферту и политику.",
        location: "Все страницы",
        icon: Layout
    },
    ui_drive_connect: {
        title: "Кнопка 'Подключить Drive'",
        description: "Призыв к действию для подключения Google Drive.",
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

    const renderConfigRow = (key: string, rule: FeatureRule) => {
        const meta = FEATURE_METADATA[key as keyof AppConfig] || { 
            title: key, 
            description: "No description available", 
            location: "Unknown", 
            icon: Power 
        };
        const Icon = meta.icon;

        return (
            <div key={key} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
                
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-400">
                            <Icon size={20} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-bold text-base text-zinc-900 dark:text-white">
                                    {meta.title}
                                </h4>
                                <span className="text-[10px] font-mono text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                                    {key}
                                </span>
                            </div>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-xl">
                                {meta.description}
                            </p>
                        </div>
                    </div>
                    <div className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold uppercase tracking-wider rounded-full border border-indigo-100 dark:border-indigo-500/20 whitespace-nowrap">
                        📍 {meta.location}
                    </div>
                </div>

                {/* Controls Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-8 border-t border-zinc-100 dark:border-zinc-800 pt-4">
                    
                    {/* Free Tier Column */}
                    <div className="space-y-3 pb-4 md:pb-0 border-b md:border-b-0 border-zinc-100 dark:border-zinc-800">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 rounded-full bg-zinc-400"></div>
                            <span className="text-xs font-bold uppercase text-zinc-500">Free Tier</span>
                        </div>
                        
                        <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-950 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800">
                            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Доступно</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={rule.enabledForFree}
                                    onChange={(e) => handleConfigChange(key as keyof AppConfig, 'enabledForFree', e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-zinc-600"></div>
                            </label>
                        </div>

                        {rule.limitFree !== undefined && (
                            <div className="flex items-center gap-3">
                                <label className="text-xs font-medium text-zinc-500 shrink-0 w-16">Лимит:</label>
                                <input
                                    type="number"
                                    value={rule.limitFree}
                                    onChange={(e) => handleConfigChange(key as keyof AppConfig, 'limitFree', parseInt(e.target.value))}
                                    className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition-colors"
                                />
                            </div>
                        )}
                    </div>

                    {/* Pro Tier Column */}
                    <div className="space-y-3 md:pl-8 md:border-l border-zinc-100 dark:border-zinc-800 pt-4 md:pt-0">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                            <span className="text-xs font-bold uppercase text-indigo-500">Pro Tier</span>
                        </div>

                        <div className="flex items-center justify-between bg-indigo-50/50 dark:bg-indigo-900/10 p-3 rounded-lg border border-indigo-100 dark:border-indigo-500/20">
                            <span className="text-sm font-medium text-indigo-900 dark:text-indigo-100">Доступно</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={rule.enabledForPro}
                                    onChange={(e) => handleConfigChange(key as keyof AppConfig, 'enabledForPro', e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>

                        {rule.limitPro !== undefined && (
                            <div className="flex items-center gap-3">
                                <label className="text-xs font-medium text-indigo-500 shrink-0 w-16">Лимит:</label>
                                <input
                                    type="number"
                                    value={rule.limitPro}
                                    onChange={(e) => handleConfigChange(key as keyof AppConfig, 'limitPro', parseInt(e.target.value))}
                                    className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-indigo-500 transition-colors"
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

            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-500/20 p-4 rounded-xl mb-8 flex items-start gap-3">
                <AlertTriangle className="text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" size={20} />
                <div>
                    <h3 className="text-sm font-bold text-amber-800 dark:text-amber-400">Глобальные флаги (Feature Flags)</h3>
                    <p className="text-xs text-amber-700/80 dark:text-amber-500/80 leading-relaxed mt-1">
                        Эти настройки применяются мгновенно ко всем пользователям системы. Используйте их для включения/выключения функционала или изменения лимитов без повторного деплоя кода.
                    </p>
                </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-8 sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-md py-4 z-10 -mx-4 px-4 border-b border-zinc-100 dark:border-zinc-800">
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

            <div className="space-y-4">
                {CONFIG_GROUPS[settingsSubTab as keyof typeof CONFIG_GROUPS].map((key) => renderConfigRow(key, config[key as keyof AppConfig]))}
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
