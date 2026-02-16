
import React, { useState } from 'react';
import { Copy, RefreshCw, Zap, Target, Gem, Layers, CheckCircle2, MessageSquare } from 'lucide-react';

// --- SMM STRATEGY DATA ---
// Based on SMART Strategy: Sell 150 Founder's Club licenses, focus on NLE Export & Speed.

type ContentCategory = 'PAIN' | 'FEATURE' | 'OFFER' | 'PROOF';

interface PostTemplate {
    id: string;
    category: ContentCategory;
    hook: string;
    body: string;
    cta: string;
    imageHint: string;
}

const GENERATORS: Record<ContentCategory, { hooks: string[], bodies: string[], ctas: string[], images: string[] }> = {
    PAIN: {
        hooks: [
            "Сколько часов вы тратите на расшифровку правок из WhatsApp?",
            "«На 15-й секунде что-то не то...» — знакомо?",
            "Почему клиенты не могут просто написать таймкод?",
            "Хватит пересылать файлы через Облако Mail.ru."
        ],
        bodies: [
            "Хаос в переписке убивает творчество. Пока вы ищете нужный комментарий в чате, вы могли бы уже закончить монтаж.",
            "Мы посчитали: на согласование одного ролика уходит до 5 дней. Из них 3 дня — это просто ожидание и попытки понять, что имел в виду клиент.",
            "Разрозненные комментарии, потерянные файлы, битые ссылки. Это не работа, это ад пост-продакшена.",
            "Ваш клиент смотрит видео с телефона, пишет правки голосом, а вы потом пытаетесь найти это место на таймлайне."
        ],
        ctas: [
            "Anotee решает это за минуту. Просто загрузите видео.",
            "Забудьте об этом. Попробуйте Anotee бесплатно.",
            "Сэкономьте свои нервы. Ссылка в профиле.",
            "Переходите на профессиональный инструмент ревью."
        ],
        images: [
            "Скриншот длинной переписки в WhatsApp с кучей голосовых.",
            "Мем с грустным монтажером.",
            "Сравнение: Хаос в чате vs Порядок в Anotee."
        ]
    },
    FEATURE: {
        hooks: [
            "Экспорт маркеров в DaVinci Resolve в один клик.",
            "Ваше видео тормозит при просмотре? Только не в Anotee.",
            "Сравнение версий Side-by-Side: киллер-фича.",
            "Как отдать 4K материал клиенту, если у него слабый интернет?"
        ],
        bodies: [
            "Больше не нужно перебивать правки вручную. Выгружайте XML файл из Anotee и импортируйте прямо на таймлайн DaVinci или Premiere. Маркеры встанут точно по кадрам.",
            "Мы создаем мгновенные прокси. Клиент может смотреть 4K исходник с мобильного интернета в метро, и ничего не будет лагать.",
            "Загрузили v2? Откройте режим сравнения. Плеер покажет два видео рядом и синхронизирует их. Сразу видно, исправили вы цвет или нет.",
            "Точность до кадра. Мы не используем секунды, мы используем фреймы. Никакого рассинхрона звука."
        ],
        ctas: [
            "Попробуйте эту функцию в демо-режиме на сайте.",
            "Это меняет правила игры. Доступно в Founder's Club.",
            "Смотрите, как это работает (видео по ссылке).",
            "Тестируйте прямо сейчас, это бесплатно."
        ],
        images: [
            "Скриншот интерфейса DaVinci Resolve с маркерами из Anotee.",
            "GIF анимация сравнения Side-by-Side.",
            "Фото интерфейса плеера с открытым списком версий."
        ]
    },
    OFFER: {
        hooks: [
            "Мы закрываем продажи Lifetime лицензий.",
            "Почему мы не берем деньги каждый месяц?",
            "Последний шанс вступить в Founder's Club.",
            "Экономия 30,000 рублей в год."
        ],
        bodies: [
            "Frame.io стоит $15 в месяц. Anotee стоит 2900₽ ОДИН РАЗ и навсегда. Мы строим инди-проект и предлагаем честную сделку ранним пользователям.",
            "Мы ищем 150 основателей, которые поверят в нас на старте. Взамен вы получаете безлимитный доступ ко всем функциям v1 навсегда.",
            "Скоро мы перейдем на подписку (SaaS). Текущая цена — это подарок для тех, кто с нами с самого начала.",
            "Вы платите один раз. Пользуетесь вечно. Никаких скрытых списаний. Экспорт, безлимит проектов, 4K."
        ],
        ctas: [
            "Заберите свою лицензию: anotee.com",
            "Осталось мало мест. Ссылка в описании.",
            "Станьте Founder'ом сегодня.",
            "Инвестируйте в свой воркфлоу один раз."
        ],
        images: [
            "Красивая карточка 'Founder Card' с золотым тиснением.",
            "График: Цена Frame.io за год vs Цена Anotee.",
            "Скриншот тарифов с зачеркнутой ценой."
        ]
    },
    PROOF: {
        hooks: [
            "С 5 дней до 4 часов. Реальный кейс.",
            "Почему студии переходят на Anotee?",
            "«Наконец-то я понимаю, что от меня хотят».",
            "Как сдать проект с первой правки?"
        ],
        bodies: [
            "Наш пользователь сократил время согласования рекламного ролика на 92%. Клиент просто тыкал в экран и писал комментарии. Никаких созвонов.",
            "Профессиональные колористы выбирают нас за точность цветопередачи и возможность скачивания оригиналов.",
            "Интерфейс настолько прост, что в нем разберется даже ваша бабушка. Клиенту не нужно регистрироваться, просто скиньте ссылку.",
            "Безопасность. Ваши файлы не видны никому, кроме тех, кому вы дали ссылку. Возможность запаролить проект."
        ],
        ctas: [
            "Читайте полную историю в нашем блоге.",
            "Присоединяйтесь к сообществу профессионалов.",
            "Начните работать быстрее уже сегодня.",
            "Попробуйте сами."
        ],
        images: [
            "Фото довольного монтажера за работой.",
            "Отзыв клиента (скриншот сообщения).",
            "Инфографика: Было / Стало."
        ]
    }
};

const getRandom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

const generatePosts = (count: number): PostTemplate[] => {
    const posts: PostTemplate[] = [];
    const categories: ContentCategory[] = ['PAIN', 'FEATURE', 'OFFER', 'PROOF'];
    
    for (let i = 0; i < count; i++) {
        // Rotate categories
        const cat = categories[i % categories.length];
        const gen = GENERATORS[cat];
        
        posts.push({
            id: Math.random().toString(36).substr(2, 9),
            category: cat,
            hook: getRandom(gen.hooks),
            body: getRandom(gen.bodies),
            cta: getRandom(gen.ctas),
            imageHint: getRandom(gen.images)
        });
    }
    return posts;
};

export const AdminContentTab: React.FC = () => {
    const [posts, setPosts] = useState<PostTemplate[]>(generatePosts(4));
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const handleGenerate = () => {
        setPosts(generatePosts(4));
    };

    const handleCopy = (post: PostTemplate) => {
        const text = `**${post.hook}**\n\n${post.body}\n\n👉 ${post.cta}`;
        navigator.clipboard.writeText(text);
        setCopiedId(post.id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const getIcon = (cat: ContentCategory) => {
        switch (cat) {
            case 'PAIN': return <Zap className="text-red-500" size={16} />;
            case 'FEATURE': return <Layers className="text-blue-500" size={16} />;
            case 'OFFER': return <Gem className="text-purple-500" size={16} />;
            case 'PROOF': return <Target className="text-green-500" size={16} />;
        }
    };

    const getLabel = (cat: ContentCategory) => {
        switch (cat) {
            case 'PAIN': return 'Боли / Проблема';
            case 'FEATURE': return 'Фича / Решение';
            case 'OFFER': return 'Оффер / Продажа';
            case 'PROOF': return 'Кейс / Доверие';
        }
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 w-full pb-24">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-900/50 to-cyan-900/50 border border-blue-500/20 p-6 rounded-2xl relative overflow-hidden mb-8">
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                    <MessageSquare size={120} />
                </div>
                <div className="relative z-10">
                    <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                        <Zap className="text-blue-400" /> SMM Авто-пилот
                    </h2>
                    <p className="text-blue-200 text-sm max-w-2xl leading-relaxed">
                        Генератор контента на основе S.M.A.R.T. стратегии. Создает посты, чередуя боли клиентов, демонстрацию фич и продажу Founder's Club.
                    </p>
                </div>
            </div>

            {/* Controls */}
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-zinc-400 uppercase text-xs tracking-wider">Контент-план (Drafts)</h3>
                <button 
                    onClick={handleGenerate}
                    className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-lg text-sm font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors shadow-sm"
                >
                    <RefreshCw size={16} /> Сгенерировать новые
                </button>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {posts.map((post) => (
                    <div key={post.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 flex flex-col h-full hover:border-indigo-500/50 transition-colors relative group">
                        
                        {/* Category Badge */}
                        <div className="flex items-center gap-2 mb-4">
                            <div className="p-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-md">
                                {getIcon(post.category)}
                            </div>
                            <span className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider">
                                {getLabel(post.category)}
                            </span>
                        </div>

                        {/* Content */}
                        <div className="flex-1 space-y-4">
                            <div>
                                <div className="text-xs font-bold text-zinc-400 mb-1">Заголовок (Hook)</div>
                                <div className="font-bold text-zinc-900 dark:text-white text-sm leading-snug">
                                    {post.hook}
                                </div>
                            </div>
                            
                            <div>
                                <div className="text-xs font-bold text-zinc-400 mb-1">Тело (Value)</div>
                                <div className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                                    {post.body}
                                </div>
                            </div>

                            <div>
                                <div className="text-xs font-bold text-zinc-400 mb-1">Призыв (CTA)</div>
                                <div className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                                    👉 {post.cta}
                                </div>
                            </div>

                            <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800">
                                <div className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Картинка / Видео</div>
                                <div className="text-xs text-zinc-400 italic">
                                    {post.imageHint}
                                </div>
                            </div>
                        </div>

                        {/* Action */}
                        <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                            <button 
                                onClick={() => handleCopy(post)}
                                className={`w-full py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                                    copiedId === post.id 
                                        ? 'bg-green-600 text-white' 
                                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                                }`}
                            >
                                {copiedId === post.id ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                                {copiedId === post.id ? 'Скопировано!' : 'Копировать пост'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
