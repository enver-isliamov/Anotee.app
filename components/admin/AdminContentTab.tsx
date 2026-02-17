
import React, { useState } from 'react';
import { Copy, Sparkles, Wand2, RefreshCw, MessageSquare, Edit3, Terminal, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

// --- PROMPT TEMPLATES ---
// These are the starting points that the user can edit.
const PROMPT_TEMPLATES = {
    INTRO: `Напиши приветственный пост для нового пользователя Anotee.
Цель: Объяснить, что Anotee — это инструмент для видео-коллаборации, который заменяет переписки в Telegram и Excel-таблицы.
Боли: Хаос в правках, таймкоды вручную, потерянные файлы.
Решение: Комментарии прямо на видео, экспорт в DaVinci/Premiere.
Тон: Дружелюбный, профессиональный, "от создателей для создателей".`,

    EDUCATION: `Напиши обучающий пост про функцию "Экспорт XML" в Anotee.
Цель: Научить пользователя экспортировать комментарии в монтажную программу.
Факты: Мы поддерживаем DaVinci Resolve (.xml) и Premiere Pro (.csv). Это экономит часы ручного перебивания правок.
Тон: Экспертный, технический, но простой.`,

    SALES: `Напиши продающий пост для тарифа "Founder's Club".
Оффер: Заплати один раз $30 и пользуйся вечно (Lifetime). В будущем будет подписка, но для ранних пользователей — халява.
Срочность: Предложение ограничено первыми 150 пользователями.
Аргумент: Это инвестиция в инструмент, а не аренда.`,

    WORKFLOW: `Напиши пост-кейс про "Утверждение с клиентом".
Сценарий: Клиент не хочет регистрироваться.
Решение: В Anotee можно отправить Публичную ссылку (Review Link). Клиент просто открывает и пишет комменты. Никаких логинов.
Тон: "Lifehack", упрощение жизни.`
};

type TemplateKey = keyof typeof PROMPT_TEMPLATES;

export const AdminContentTab: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TemplateKey>('INTRO');
    const [customPrompt, setCustomPrompt] = useState(PROMPT_TEMPLATES['INTRO']);
    
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<{ hook: string, body: string, cta: string, imageHint: string } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const handleTabChange = (key: TemplateKey) => {
        setActiveTab(key);
        setCustomPrompt(PROMPT_TEMPLATES[key]);
        setResult(null);
        setError(null);
    };

    const handleGenerate = async () => {
        setIsLoading(true);
        setError(null);
        setResult(null);

        try {
            // Retrieve token implicitly handled by browser cookies or if we need explicit header:
            // Since this is a client-side component inside ClerkProvider, we usually need getToken()
            // But for simplicity in this specific file context, let's assume standard fetch or injected fetch.
            // *CORRECTION*: We must use proper auth headers as per api/generate.js requirements.
            
            // NOTE: In a real app, we would import useAuth() here. 
            // Assuming this component is wrapped in Auth context.
            // I will use a simple fetch, assuming the browser session cookie works or 
            // passing headers if useAuth was available in scope. 
            // To ensure it works, I'll add the bearer token extraction if this component is used inside the AdminPanel which has auth.
            
            // Let's assume the parent passes auth or we fetch it. 
            // For this specific snippet replacement, I'll assume global fetch works or fail gracefully.
            // BETTER: Let's fetch the token from localStorage or similar if Clerk stores it, 
            // OR ideally, use useAuth hook inside here.
            
            // RE-ADDING IMPORTS FOR AUTH
            // (See top of file imports, I will need to add useAuth)
            
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Note: We need the token here. I will use a placeholder or assume the interceptor adds it.
                    // However, standard Clerk requires explicit token passing.
                    // I will add the token logic below in the full implementation block.
                },
                body: JSON.stringify({
                    prompt: customPrompt,
                    model: 'gemini-2.5-flash' // Fast model
                })
            });

            const data = await response.json();

            if (!response.ok) {
                // If 401, it means we forgot the token. 
                // Since I cannot easily change the parent to pass token prop in this single file edit 
                // without breaking props interface, I will try to use the hook.
                throw new Error(data.error || "Generation failed");
            }

            setResult(data);
        } catch (e: any) {
            console.error(e);
            if (e.message.includes('Unauthorized')) {
                setError("Ошибка авторизации. Перезагрузите страницу.");
            } else {
                setError(e.message || "Ошибка соединения с ИИ");
            }
        } finally {
            setIsLoading(false);
        }
    };

    // We need to inject the token. 
    // Since I can't import useAuth here without ensuring @clerk/clerk-react is installed (it is), 
    // I will modify the generate function to use the clerk hook.
    
    // WRAPPER COMPONENT PATTERN to use Hooks safely
    return <AdminContentTabInner />;
};

// Separated component to safely use Hooks
import { useAuth } from '@clerk/clerk-react';

const AdminContentTabInner: React.FC = () => {
    const { getToken } = useAuth();
    const [activeTab, setActiveTab] = useState<TemplateKey>('INTRO');
    const [customPrompt, setCustomPrompt] = useState(PROMPT_TEMPLATES['INTRO']);
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<{ hook: string, body: string, cta: string, imageHint: string } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const handleTabChange = (key: TemplateKey) => {
        setActiveTab(key);
        setCustomPrompt(PROMPT_TEMPLATES[key]);
        setError(null);
    };

    const handleGenerate = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const token = await getToken();
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ prompt: customPrompt })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "AI Error");
            setResult(data);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
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
        <div className="w-full pb-24 grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* LEFT COLUMN: CONTROLS */}
            <div className="space-y-6">
                
                {/* 1. Header */}
                <div className="bg-gradient-to-r from-violet-900/50 to-indigo-900/50 border border-indigo-500/20 p-6 rounded-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                        <Sparkles size={100} />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                        <Wand2 className="text-indigo-400" /> AI Content Studio
                    </h2>
                    <p className="text-indigo-200 text-xs leading-relaxed">
                        Генерация контента на базе <strong>Gemini 2.5 Flash</strong>. Выберите шаблон или напишите свой промт.
                    </p>
                </div>

                {/* 2. Template Selector */}
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {(Object.keys(PROMPT_TEMPLATES) as TemplateKey[]).map(key => (
                        <button
                            key={key}
                            onClick={() => handleTabChange(key)}
                            className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all border ${
                                activeTab === key 
                                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white border-zinc-300 dark:border-zinc-600 shadow-sm' 
                                    : 'bg-transparent text-zinc-500 border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-900'
                            }`}
                        >
                            {key}
                        </button>
                    ))}
                </div>

                {/* 3. Prompt Editor */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-1 overflow-hidden shadow-inner group focus-within:border-indigo-500/50 transition-colors">
                    <div className="bg-zinc-950 px-4 py-2 border-b border-zinc-800 flex items-center gap-2 text-zinc-500">
                        <Terminal size={12} />
                        <span className="text-[10px] font-mono uppercase tracking-wider">System Prompt</span>
                    </div>
                    <textarea
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        className="w-full h-64 bg-zinc-900 p-4 text-sm text-zinc-300 font-mono outline-none resize-none leading-relaxed"
                        placeholder="Опишите задачу для ИИ..."
                    />
                    <div className="bg-zinc-900 p-2 flex justify-end border-t border-zinc-800">
                        <button 
                            onClick={handleGenerate}
                            disabled={isLoading}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-50 shadow-lg shadow-indigo-900/20"
                        >
                            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                            {isLoading ? 'Генерирую...' : 'Запустить AI'}
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
                        <MessageSquare size={14} /> Результат генерации
                    </h3>

                    {isLoading ? (
                        <div className="h-96 border-2 border-dashed border-zinc-800 rounded-2xl flex flex-col items-center justify-center text-zinc-600 gap-4 bg-zinc-900/30">
                            <RefreshCw size={32} className="animate-spin text-indigo-500" />
                            <p className="text-xs animate-pulse">Gemini пишет пост...</p>
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

                            {/* Image Hint */}
                            <div className="mb-8 p-3 bg-zinc-800/50 border border-dashed border-zinc-700 rounded-xl flex gap-3 items-start">
                                <div className="p-1.5 bg-zinc-800 rounded text-zinc-400 shrink-0">
                                    <Edit3 size={14} />
                                </div>
                                <div>
                                    <span className="text-[10px] text-zinc-500 font-bold uppercase block mb-0.5">Визуальная идея</span>
                                    <p className="text-xs text-zinc-400 italic">{result.imageHint}</p>
                                </div>
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
                            <p className="text-xs">Нажмите "Запустить AI", чтобы увидеть магию.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
