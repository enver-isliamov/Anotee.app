
import React, { useState, useEffect } from 'react';
import { Copy, Sparkles, Wand2, RefreshCw, MessageSquare, Edit3, Terminal, CheckCircle2, AlertTriangle, Loader2, Image as ImageIcon, Settings, Save, Key, Check, Target, Lightbulb, TrendingUp, BookOpen, Briefcase } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';

const STRATEGY_GOALS = [
    { id: 'Awareness', label: 'Охват (Viral)', icon: Sparkles, desc: 'Для холодной аудитории. Кликбейтные заголовки.' },
    { id: 'Education', label: 'Обучение (Value)', icon: BookOpen, desc: 'Экспертный контент. Полезные советы.' },
    { id: 'Conversion', label: 'Продажа (Sales)', icon: TrendingUp, desc: 'Закрытие сделки. FOMO, офферы.' },
    { id: 'CaseStudy', label: 'Кейс (Trust)', icon: Briefcase, desc: 'Реальный пример использования.' },
];

export const AdminContentTab: React.FC = () => {
    return <AdminContentTabInner />;
};

const AdminContentTabInner: React.FC = () => {
    const { getToken } = useAuth();
    const [selectedGoal, setSelectedGoal] = useState<string>('Awareness');
    const [customPrompt, setCustomPrompt] = useState('');
    const [isGeneratingMeta, setIsGeneratingMeta] = useState(false); // New state for prompt generation
    const [isLoading, setIsLoading] = useState(false); // State for content generation
    const [result, setResult] = useState<{ hook: string, body: string, cta: string, imageHint: string } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    // Image Gen State
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);

    // Settings State
    const [showSettings, setShowSettings] = useState(false);
    const [aiConfig, setAiConfig] = useState<{ provider: 'gemini' | 'openai', hasOpenAiKey: boolean }>({ provider: 'gemini', hasOpenAiKey: false });
    const [newOpenAiKey, setNewOpenAiKey] = useState('');
    const [isSavingSettings, setIsSavingSettings] = useState(false);

    // Load AI Config
    useEffect(() => {
        const loadConfig = async () => {
            try {
                const token = await getToken();
                const res = await fetch('/api/admin?action=get_ai_config', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setAiConfig(data);
                }
            } catch (e) { console.error("Config load failed", e); }
        };
        loadConfig();
    }, [getToken]);

    const handleSaveSettings = async () => {
        setIsSavingSettings(true);
        try {
            const token = await getToken();
            await fetch('/api/admin?action=update_ai_config', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    provider: aiConfig.provider,
                    openaiKey: newOpenAiKey || undefined 
                })
            });
            setNewOpenAiKey(''); 
            setAiConfig(prev => ({ ...prev, hasOpenAiKey: newOpenAiKey ? true : prev.hasOpenAiKey }));
            setShowSettings(false);
        } catch (e) {
            alert("Ошибка сохранения настроек");
        } finally {
            setIsSavingSettings(false);
        }
    };

    // 1. META-PROMPT GENERATION (New Logic)
    const handleGeneratePrompt = async () => {
        setIsGeneratingMeta(true);
        setError(null);
        try {
            const token = await getToken();
            // This endpoint ALWAYS uses free Gemini
            const response = await fetch('/api/admin?action=generate_meta_prompt', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ goal: selectedGoal })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Meta-Prompt Error");
            
            setCustomPrompt(data.prompt);
        } catch (e: any) {
            setError("Ошибка создания промпта: " + e.message);
        } finally {
            setIsGeneratingMeta(false);
        }
    };

    // 2. CONTENT GENERATION (Existing Logic)
    const handleGenerateContent = async () => {
        if (!customPrompt) {
            setError("Сначала создайте или введите промпт.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setGeneratedImage(null);
        try {
            const token = await getToken();
            const response = await fetch('/api/admin?action=generate_ai', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ 
                    prompt: customPrompt,
                    provider: aiConfig.provider 
                })
            });

            const text = await response.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (jsonErr) {
                console.error("Failed to parse JSON:", text);
                throw new Error("Server returned an error (Check logs).");
            }

            if (!response.ok) throw new Error(data.error || "AI Error");
            setResult(data);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerateImage = async () => {
        if (!result?.imageHint) return;
        setIsGeneratingImage(true);
        try {
            const token = await getToken();
            const res = await fetch('/api/admin?action=generate_image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ 
                    prompt: result.imageHint,
                    provider: aiConfig.provider 
                })
            });
            
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Image Gen Error");
            
            setGeneratedImage(data.image);
        } catch (e: any) {
            alert(`Ошибка генерации: ${e.message}`);
        } finally {
            setIsGeneratingImage(false);
        }
    };

    const handleCopy = () => {
        if (!result) return;
        const text = `**${result.hook}**\n\n${result.body}\n\n👉 ${result.cta}`;
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="w-full pb-24 grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
            
            {/* LEFT COLUMN: STRATEGY & INPUT */}
            <div className="space-y-6">
                
                {/* 1. Header with Settings */}
                <div className="bg-gradient-to-r from-violet-900/50 to-indigo-900/50 border border-indigo-500/20 p-6 rounded-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                        <Sparkles size={100} />
                    </div>
                    <div className="flex justify-between items-start relative z-10">
                        <div>
                            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                                <Wand2 className="text-indigo-400" /> AI Content Studio
                            </h2>
                            <p className="text-indigo-200 text-xs leading-relaxed">
                                Генератор контента. 
                                <span className="opacity-70 ml-1">
                                    Provider: {aiConfig.provider === 'openai' ? 'GPT-4 + DALL-E 3' : 'Gemini 2.5 + Imagen 3'}
                                </span>
                            </p>
                        </div>
                        <button 
                            onClick={() => setShowSettings(!showSettings)}
                            className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}
                        >
                            <Settings size={18} />
                        </button>
                    </div>

                    {/* SETTINGS DRAWER */}
                    {showSettings && (
                        <div className="mt-4 pt-4 border-t border-white/10 animate-in fade-in slide-in-from-top-2">
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <button 
                                    onClick={() => setAiConfig(p => ({ ...p, provider: 'gemini' }))}
                                    className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${aiConfig.provider === 'gemini' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-black/30 border-white/10 text-zinc-400 hover:bg-black/50'}`}
                                >
                                    <span className="font-bold text-xs">Google Gemini</span>
                                    <span className="text-[10px] opacity-70">Бесплатно (Fast)</span>
                                </button>
                                <button 
                                    onClick={() => setAiConfig(p => ({ ...p, provider: 'openai' }))}
                                    className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${aiConfig.provider === 'openai' ? 'bg-green-600 border-green-500 text-white' : 'bg-black/30 border-white/10 text-zinc-400 hover:bg-black/50'}`}
                                >
                                    <span className="font-bold text-xs">OpenAI GPT-4</span>
                                    <span className="text-[10px] opacity-70">Свой API Key (Smart)</span>
                                </button>
                            </div>
                            
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-indigo-200 uppercase">OpenAI API Key</label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Key size={14} className="absolute left-3 top-3 text-indigo-300" />
                                        <input 
                                            type="password"
                                            value={newOpenAiKey}
                                            onChange={(e) => setNewOpenAiKey(e.target.value)}
                                            placeholder={aiConfig.hasOpenAiKey ? "Key Saved (Enter to update)" : "sk-..."}
                                            className="w-full bg-black/30 border border-indigo-500/30 rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder-white/30 focus:border-indigo-400 outline-none"
                                        />
                                    </div>
                                    <button 
                                        onClick={handleSaveSettings}
                                        disabled={isSavingSettings}
                                        className="bg-white text-indigo-900 px-4 rounded-xl font-bold text-xs hover:bg-indigo-50 disabled:opacity-50"
                                    >
                                        {isSavingSettings ? <Loader2 size={14} className="animate-spin" /> : 'Save'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 2. Strategy Selector (REPLACED TEMPLATES) */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Target size={14} /> Выберите Цель (Strategy)
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                        {STRATEGY_GOALS.map(goal => (
                            <button
                                key={goal.id}
                                onClick={() => setSelectedGoal(goal.id)}
                                className={`p-3 rounded-xl border text-left transition-all ${
                                    selectedGoal === goal.id 
                                        ? 'bg-zinc-800 border-indigo-500 ring-1 ring-indigo-500/50' 
                                        : 'bg-black/20 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50'
                                }`}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <goal.icon size={16} className={selectedGoal === goal.id ? 'text-indigo-400' : 'text-zinc-500'} />
                                    <span className={`text-xs font-bold ${selectedGoal === goal.id ? 'text-white' : 'text-zinc-400'}`}>{goal.label}</span>
                                </div>
                                <div className="text-[10px] text-zinc-500 leading-tight">{goal.desc}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* 3. Prompt Editor & Generator */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-1 overflow-hidden shadow-inner group focus-within:border-indigo-500/50 transition-colors">
                    <div className="bg-zinc-950 px-4 py-2 border-b border-zinc-800 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-zinc-500">
                            <Terminal size={12} />
                            <span className="text-[10px] font-mono uppercase tracking-wider">System Prompt</span>
                        </div>
                        
                        {/* META GENERATOR BUTTON */}
                        <button 
                            onClick={handleGeneratePrompt}
                            disabled={isGeneratingMeta}
                            className="flex items-center gap-1.5 px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[10px] font-bold transition-colors disabled:opacity-50"
                        >
                            {isGeneratingMeta ? <Loader2 size={10} className="animate-spin" /> : <Lightbulb size={10} />}
                            {isGeneratingMeta ? 'Создаю инструкцию...' : 'Сгенерировать Промпт (Free)'}
                        </button>
                    </div>
                    
                    <textarea
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        className="w-full h-64 bg-zinc-900 p-4 text-sm text-zinc-300 font-mono outline-none resize-none leading-relaxed placeholder-zinc-700"
                        placeholder="Здесь появится сгенерированная инструкция для ИИ. Вы можете её отредактировать перед созданием поста..."
                    />
                    
                    <div className="bg-zinc-900 p-2 flex justify-end border-t border-zinc-800">
                        <button 
                            onClick={handleGenerateContent}
                            disabled={isLoading || !customPrompt}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-900/20"
                        >
                            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                            {isLoading ? 'Пишу пост...' : 'Создать Контент'}
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-xl flex items-center gap-3 text-red-400 text-xs">
                        <AlertTriangle size={16} />
                        {error}
                    </div>
                )}
            </div>

            {/* RIGHT COLUMN: PREVIEW */}
            <div className="relative">
                <div className="sticky top-6">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <MessageSquare size={14} /> Результат
                    </h3>

                    {isLoading ? (
                        <div className="h-96 border-2 border-dashed border-zinc-800 rounded-2xl flex flex-col items-center justify-center text-zinc-600 gap-4 bg-zinc-900/30">
                            <RefreshCw size={32} className="animate-spin text-indigo-500" />
                            <p className="text-xs animate-pulse">ИИ пишет пост...</p>
                        </div>
                    ) : result ? (
                        <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl relative group">
                            
                            {/* Hook */}
                            <div className="mb-6">
                                <span className="text-[10px] text-indigo-400 font-bold uppercase mb-1 block">Hook (Заголовок)</span>
                                <h2 className="text-lg md:text-xl font-bold text-white leading-tight">
                                    {result.hook}
                                </h2>
                            </div>

                            {/* Body */}
                            <div className="mb-6 space-y-4">
                                <span className="text-[10px] text-zinc-500 font-bold uppercase mb-1 block">Body</span>
                                <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                                    {result.body}
                                </p>
                            </div>

                            {/* CTA */}
                            <div className="mb-6 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                                <span className="text-[10px] text-indigo-300 font-bold uppercase mb-1 block">Call To Action</span>
                                <p className="text-sm font-medium text-indigo-200">
                                    👉 {result.cta}
                                </p>
                            </div>

                            {/* Image Hint & Generator */}
                            <div className="mb-8 p-4 bg-zinc-800/50 border border-dashed border-zinc-700 rounded-xl">
                                <div className="flex items-start gap-3 mb-3">
                                    <div className="p-1.5 bg-zinc-800 rounded text-zinc-400 shrink-0">
                                        <Edit3 size={14} />
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-zinc-500 font-bold uppercase block mb-0.5">Визуальная идея</span>
                                        <p className="text-xs text-zinc-400 italic leading-relaxed">{result.imageHint}</p>
                                    </div>
                                </div>
                                
                                {generatedImage ? (
                                    <div className="mt-4 relative group/img rounded-lg overflow-hidden border border-zinc-700">
                                        <img src={generatedImage} className="w-full h-auto object-cover" alt="Generated" />
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                            <a href={generatedImage} download="anotee-ai-image.png" className="px-3 py-1.5 bg-white text-black rounded-lg text-xs font-bold flex items-center gap-2 hover:scale-105 transition-transform">
                                                <DownloadIcon /> Скачать
                                            </a>
                                        </div>
                                    </div>
                                ) : (
                                    <button 
                                        onClick={handleGenerateImage}
                                        disabled={isGeneratingImage}
                                        className="w-full mt-2 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors border border-zinc-700"
                                    >
                                        {isGeneratingImage ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
                                        {isGeneratingImage ? 'Рисую...' : `🎨 Визуализировать (${aiConfig.provider === 'openai' ? 'DALL-E 3' : 'Imagen 3'})`}
                                    </button>
                                )}
                            </div>

                            {/* Action Footer */}
                            <div className="pt-6 border-t border-zinc-800 flex justify-end">
                                <button 
                                    onClick={handleCopy}
                                    className={`px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg ${
                                        copied 
                                            ? 'bg-green-600 text-white' 
                                            : 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700'
                                    }`}
                                >
                                    {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                                    {copied ? 'Скопировано!' : 'Копировать'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="h-96 border border-zinc-800 rounded-2xl flex flex-col items-center justify-center text-zinc-600 gap-2 bg-zinc-900/30">
                            <Sparkles size={24} className="opacity-20" />
                            <p className="text-xs">Нажмите "Создать Контент", чтобы увидеть магию.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const DownloadIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
);
