
import React from 'react';
import { Target, Flag, BarChart3, Lightbulb, Zap, ListTodo, CheckCircle2, Circle } from 'lucide-react';

export const AdminStrategyTab: React.FC = () => {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-8 w-full">
            {/* Header */}
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

            {/* SMART GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* SPECIFIC */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl relative">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-500"><Target size={16} /></div>
                        <h3 className="text-xs font-bold uppercase text-indigo-500 tracking-wider">Specific (Конкретика)</h3>
                    </div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                        Продать 150 пожизненных лицензий (Founder's Club) для финансирования маркетинга, затем конвертировать 5% бесплатных пользователей в ежемесячную подписку Pro.
                    </p>
                </div>

                {/* MEASURABLE */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl relative">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-1.5 bg-green-500/10 rounded-lg text-green-500"><BarChart3 size={16} /></div>
                        <h3 className="text-xs font-bold uppercase text-green-500 tracking-wider">Measurable (Измеримость)</h3>
                    </div>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between border-b border-zinc-100 dark:border-zinc-800 pb-1"><span>Выручка (фаза 1):</span><span className="font-mono font-bold text-white">435,000 ₽</span></div>
                        <div className="flex justify-between border-b border-zinc-100 dark:border-zinc-800 pb-1"><span>MRR (фаза 2):</span><span className="font-mono font-bold text-white">100,000 ₽/мес</span></div>
                        <div className="flex justify-between"><span>Пользователей:</span><span className="font-mono font-bold text-white">1,000+</span></div>
                    </div>
                </div>

                {/* ACHIEVABLE */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl relative">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-1.5 bg-blue-500/10 rounded-lg text-blue-500"><Lightbulb size={16} /></div>
                        <h3 className="text-xs font-bold uppercase text-blue-500 tracking-wider">Achievable (Достижимость)</h3>
                    </div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                        Рынок фрилансеров-монтажеров в РФ огромен. Anotee предлагает уникальный функционал (экспорт в Resolve) за 2900₽ разово, что дешевле 1 месяца Frame.io.
                    </p>
                </div>

                {/* RELEVANT */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl relative">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-1.5 bg-yellow-500/10 rounded-lg text-yellow-500"><Zap size={16} /></div>
                        <h3 className="text-xs font-bold uppercase text-yellow-500 tracking-wider">Relevant (Актуальность)</h3>
                    </div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                        Санкции усложнили оплату зарубежных сервисов. Anotee — локальное решение с серверами Vercel (быстрый доступ) и оплатой через ЮKassa.
                    </p>
                </div>
            </div>

            {/* TIME-BOUND */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-6">
                    <div className="p-1.5 bg-red-500/10 rounded-lg text-red-500"><ListTodo size={16} /></div>
                    <h3 className="text-xs font-bold uppercase text-red-500 tracking-wider">Time-Bound (Сроки)</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="border border-zinc-800 bg-zinc-900 p-4 rounded-xl">
                        <div className="text-[10px] text-zinc-500 mb-1">Месяц 1-3</div>
                        <div className="text-sm font-bold text-white mb-2">Продажа Founders</div>
                        <div className="text-xs text-zinc-500">Сбор фидбека, фикс багов.</div>
                    </div>
                    <div className="border border-zinc-800 bg-zinc-900 p-4 rounded-xl opacity-60">
                        <div className="text-[10px] text-zinc-500 mb-1">Месяц 4-6</div>
                        <div className="text-sm font-bold text-white mb-2">Запуск Подписки</div>
                        <div className="text-xs text-zinc-500">Закрытие Lifetime продаж.</div>
                    </div>
                    <div className="border border-zinc-800 bg-zinc-900 p-4 rounded-xl opacity-40">
                        <div className="text-[10px] text-zinc-500 mb-1">Месяц 7+</div>
                        <div className="text-sm font-bold text-white mb-2">B2B Продажи</div>
                        <div className="text-xs text-zinc-500">Продажа студиям (Team Plan).</div>
                    </div>
                </div>
            </div>

            {/* TACTICAL PLAN */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    <ListTodo className="text-green-500" size={20} /> Тактический план (Growth Hacking)
                </h3>
                <div className="space-y-1">
                    {[
                        { done: true, text: "Запуск MVP с функцией экспорта XML (УТП)" },
                        { done: true, text: "Настройка ЮKassa и рекуррентных платежей" },
                        { done: false, text: "Холодная рассылка по студиям (Telegram/Email) с предложением демо" },
                        { done: false, text: "Публикация кейса на VC.ru: 'Как я заменил Frame.io за 2900р'" },
                        { done: false, text: "SEO оптимизация лендинга под запросы 'frame.io аналог', 'видео ревью'" },
                        { done: false, text: "Партнерство с киношколами (бесплатный доступ студентам -> лояльность)" },
                    ].map((item, i) => (
                        <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border border-transparent transition-colors ${item.done ? 'bg-green-900/10' : 'hover:bg-zinc-800'}`}>
                            {item.done ? (
                                <CheckCircle2 size={18} className="text-green-500 shrink-0" />
                            ) : (
                                <Circle size={18} className="text-zinc-600 shrink-0" />
                            )}
                            <span className={`text-sm ${item.done ? 'text-green-200 line-through decoration-green-800' : 'text-zinc-300'}`}>{item.text}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
