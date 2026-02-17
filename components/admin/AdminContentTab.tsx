
import React, { useState } from 'react';
import { Copy, RefreshCw, Zap, BookOpen, Lightbulb, GraduationCap, CheckCircle2, MessageSquare, Hand, Sparkles } from 'lucide-react';

// --- STRATEGY: PRODUCT-LED GROWTH (PLG) ---
// Focus: Education, Workflow improvement, Feature discovery. No hard selling.

type ContentCategory = 'EDUCATION' | 'WORKFLOW' | 'DEEP_DIVE' | 'PHILOSOPHY';

interface PostTemplate {
    id: string;
    category: ContentCategory | 'INTRO';
    hook: string;
    body: string;
    cta: string;
    imageHint: string;
}

// 1. INTRO / WELCOME GENERATOR
const INTRO_TEMPLATES: PostTemplate[] = [
    {
        id: 'intro-1',
        category: 'INTRO',
        hook: "Привет! Мы — Anotee. Давайте знакомиться.",
        body: "Мы создали платформу для видео-коллаборации, потому что устали от хаоса в Telegram-чатах и бесконечных таблиц с правками.\n\nAnotee — это мост между клиентом и монтажером. Вы загружаете видео, клиент тыкает в экран и пишет комментарий. Вы скачиваете эти комментарии прямо в Premiere или DaVinci.\n\nНикаких лишних звонков. Только чистый поток работы.",
        cta: "Посмотрите, как это работает на сайте (демо без регистрации).",
        imageHint: "Красивый скриншот интерфейса плеера с открытыми комментариями."
    },
    {
        id: 'intro-2',
        category: 'INTRO',
        hook: "Для кого создан Anotee?",
        body: "Мы строим инструмент для:\n— Инди-фильммейкеров\n— Фриланс-монтажеров\n— Небольших студий пост-продакшена\n\nЕсли вы хоть раз тратили час на то, чтобы понять, какую именно секунду имел в виду клиент — вы наш человек. Мы убрали всё лишнее, оставив только скорость и точность.",
        cta: "Присоединяйтесь к сообществу эффективных креаторов.",
        imageHint: "Коллаж: Монтажер за работой + довольный клиент."
    },
    {
        id: 'intro-3',
        category: 'INTRO',
        hook: "Ваше видео. Идеально согласовано.",
        body: "Представьте мир, где правки приходят не голосовым сообщением, а появляются маркером на вашем таймлайне.\n\nAnotee делает это реальностью. Мы синхронизируем мысли клиента с вашим софтом для монтажа. Безопасное хранение, версионность и мгновенные прокси.",
        cta: "Попробуйте загрузить свой первый проект.",
        imageHint: "Анимация: Экспорт XML файла и импорт в DaVinci."
    }
];

// 2. REGULAR EDUCATIONAL CONTENT GENERATOR
const VALUE_GENERATORS: Record<ContentCategory, { hooks: string[], bodies: string[], ctas: string[], images: string[] }> = {
    EDUCATION: {
        hooks: [
            "Почему важна точность до кадра?",
            "Как работает экспорт XML маркеров?",
            "Что такое 'Прокси' и зачем мы их делаем?",
            "Разница между Timecode и секундами."
        ],
        bodies: [
            "В бытовом плеере секунда — это просто секунда. В монтаже секунда — это 24, 30 или 60 кадров. Ошибка на полсекунды может стоить рассинхрона звука.\nAnotee считает именно кадры. Поэтому, когда клиент ставит метку, она прилетает вам с точностью до фрейма.",
            "Перебивать правки вручную — это прошлый век. Anotee генерирует файл .xml (для Resolve) или .csv (для Premiere). Вы просто импортируете файл на таймлайн, и все комментарии превращаются в цветные маркеры.",
            "Мы автоматически конвертируем ваши тяжелые исходники в легкие файлы для веба. Это значит, что клиент сможет посмотреть 4K видео даже с мобильного интернета в метро, и оно не будет тормозить.",
            "Таймкод — это язык профессионалов. Мы учим клиентов говорить на нём, не заставляя их учиться. Они просто нажимают паузу, а Anotee делает остальное."
        ],
        ctas: [
            "Попробуйте функцию экспорта в новом проекте.",
            "Узнайте больше в нашей базе знаний.",
            "Протестируйте плеер на сайте.",
            "Экономьте время на рутине."
        ],
        images: [
            "Скриншот настроек экспорта.",
            "Схема: Исходник -> Прокси -> Клиент.",
            "Крупный план таймкода в плеере."
        ]
    },
    WORKFLOW: {
        hooks: [
            "Сценарий: Клиент не хочет регистрироваться.",
            "Как согласовать ролик за 1 итерацию?",
            "Работа с версиями: v1, v2, v_final.",
            "Как защитить черновик от скачивания?"
        ],
        bodies: [
            "Мы знаем эту боль. Клиенту лень создавать аккаунт. В Anotee мы сделали 'Гостевой доступ'. Вы кидаете ссылку, клиент заходит и сразу пишет. Никаких форм, никаких паролей (если вы сами их не поставите).",
            "Секрет не в том, чтобы делать идеально с первого раза, а в том, чтобы четко понять правки. Используйте инструменты рисования (скоро) и точечные комментарии, чтобы исключить недопонимание.",
            "Не плодите папки 'Финал_точно_финал_2'. Загружайте новую версию поверх старой. Anotee сохранит историю, и вы всегда сможете включить режим сравнения Side-by-Side.",
            "В настройках проекта можно отключить скачивание оригинала. Клиент сможет только смотреть и комментировать, но не унесет файл до полной оплаты."
        ],
        ctas: [
            "Отправьте первую гостевую ссылку сегодня.",
            "Организуйте свой воркфлоу правильно.",
            "Попробуйте сравнение версий в демо.",
            "Настройте права доступа в один клик."
        ],
        images: [
            "Интерфейс настройки публичной ссылки.",
            "Скриншот сравнения двух видео рядом.",
            "Иконка замка на проекте."
        ]
    },
    DEEP_DIVE: {
        hooks: [
            "Разбираем интерфейс плеера.",
            "Горячие клавиши, которые ускорят вас в 2 раза.",
            "Как работает наше облачное хранилище?",
            "Интеграция с Google Drive: как это устроено."
        ],
        bodies: [
            "J, K, L — это не просто буквы, это стандарт индустрии для управления скоростью. В Anotee они работают так же, как в вашей монтажке. Пробел для паузы, стрелки для покадрового сдвига.",
            "Нажмите 'M', чтобы поставить быстрый маркер. Нажмите 'F' для полного экрана. Мы перенесли привычки монтажеров в браузер.",
            "Вы можете подключить свой S3 (Yandex, Selectel) или Google Drive. Мы не держим ваши файлы в заложниках — они остаются на вашем диске, мы просто транслируем их.",
            "В плеере есть скрытая мощь. Вы можете отфильтровать комментарии по автору или статусу 'Решено'. Это превращает список правок в удобный чек-лист."
        ],
        ctas: [
            "Попробуйте навигацию клавишами прямо сейчас.",
            "Подключите свое хранилище в настройках.",
            "Изучите все возможности плеера.",
            "Работайте с комфортом десктопного приложения."
        ],
        images: [
            "Инфографика с горячими клавишами.",
            "Схема подключения S3.",
            "GIF работы с чек-листом комментариев."
        ]
    },
    PHILOSOPHY: {
        hooks: [
            "Почему мы не берем деньги за каждого юзера?",
            "Манифест чистого творчества.",
            "Инструмент должен быть незаметным.",
            "Почему скорость — это главная фича."
        ],
        bodies: [
            "Многие сервисы берут оплату за количество мест в команде. Мы считаем, что коллаборация не должна облагаться налогом. Приглашайте хоть 50 клиентов — это бесплатно.",
            "Когда вы боретесь с интерфейсом, вы теряете поток. Мы убрали всё лишнее. Anotee — это дзен-сад для ваших видео.",
            "Лучший инструмент — тот, который вы не замечаете. Загрузил, отправил, получил правки, сдал. Никакой бюрократии.",
            "Каждая минута ожидания прогрузки видео убивает творческий настрой. Мы инвестировали месяцы в оптимизацию CDN, чтобы видео стартовало мгновенно."
        ],
        ctas: [
            "Почувствуйте разницу в подходе.",
            "Поддержите независимую разработку.",
            "Присоединяйтесь к философии Anotee.",
            "Цените свое время."
        ],
        images: [
            "Минималистичный логотип на темном фоне.",
            "Фото команды за работой (или атмосферное фото студии).",
            "График скорости загрузки."
        ]
    }
};

const getRandom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

const generateFeedPosts = (count: number): PostTemplate[] => {
    const posts: PostTemplate[] = [];
    const categories: ContentCategory[] = ['EDUCATION', 'WORKFLOW', 'DEEP_DIVE', 'PHILOSOPHY'];
    
    for (let i = 0; i < count; i++) {
        const cat = categories[i % categories.length];
        const gen = VALUE_GENERATORS[cat];
        
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
    const [feedPosts, setFeedPosts] = useState<PostTemplate[]>(generateFeedPosts(4));
    const [introPost, setIntroPost] = useState<PostTemplate>(INTRO_TEMPLATES[0]);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const handleGenerateFeed = () => {
        setFeedPosts(generateFeedPosts(4));
    };

    const handleNextIntro = () => {
        const currentIdx = INTRO_TEMPLATES.findIndex(p => p.id === introPost.id);
        const nextIdx = (currentIdx + 1) % INTRO_TEMPLATES.length;
        setIntroPost(INTRO_TEMPLATES[nextIdx]);
    };

    const handleCopy = (post: PostTemplate) => {
        const text = `**${post.hook}**\n\n${post.body}\n\n👉 ${post.cta}`;
        navigator.clipboard.writeText(text);
        setCopiedId(post.id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const getIcon = (cat: ContentCategory | 'INTRO') => {
        switch (cat) {
            case 'INTRO': return <Hand className="text-yellow-500" size={16} />;
            case 'EDUCATION': return <GraduationCap className="text-blue-500" size={16} />;
            case 'WORKFLOW': return <Zap className="text-orange-500" size={16} />;
            case 'DEEP_DIVE': return <BookOpen className="text-purple-500" size={16} />;
            case 'PHILOSOPHY': return <Lightbulb className="text-green-500" size={16} />;
        }
    };

    const getLabel = (cat: ContentCategory | 'INTRO') => {
        switch (cat) {
            case 'INTRO': return 'Приветствие / Старт';
            case 'EDUCATION': return 'Обучение';
            case 'WORKFLOW': return 'Сценарий работы';
            case 'DEEP_DIVE': return 'Обзор функций';
            case 'PHILOSOPHY': return 'Философия';
        }
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 w-full pb-24">
            
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-900/50 to-teal-900/50 border border-emerald-500/20 p-6 rounded-2xl relative overflow-hidden mb-8">
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                    <Sparkles size={120} />
                </div>
                <div className="relative z-10">
                    <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                        <MessageSquare className="text-emerald-400" /> Контент-стратегия: Обучение
                    </h2>
                    <p className="text-emerald-100 text-sm max-w-2xl leading-relaxed">
                        Никаких прямых продаж. Мы рассказываем о продукте, обучаем пользователя и показываем ценность через полезный контент (Product-Led Growth).
                    </p>
                </div>
            </div>

            {/* SECTION 1: INTRO / WELCOME */}
            <div className="mb-8">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-zinc-400 uppercase text-xs tracking-wider flex items-center gap-2">
                        <Hand size={14} /> Приветственный пост (Закреп)
                    </h3>
                    <button 
                        onClick={handleNextIntro}
                        className="text-xs text-indigo-400 hover:text-white transition-colors flex items-center gap-1"
                    >
                        <RefreshCw size={12} /> Вариант {INTRO_TEMPLATES.findIndex(p => p.id === introPost.id) + 1}/{INTRO_TEMPLATES.length}
                    </button>
                </div>
                
                <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-indigo-500/30 rounded-2xl p-6 relative group hover:border-indigo-500/50 transition-all">
                    <div className="absolute top-4 right-4">
                        <span className="bg-yellow-500/10 text-yellow-500 text-[10px] font-bold px-2 py-1 rounded border border-yellow-500/20">INTRO</span>
                    </div>
                    
                    <div className="space-y-4 max-w-3xl">
                        <div>
                            <div className="text-xs font-bold text-zinc-500 mb-1">Заголовок</div>
                            <h3 className="text-lg font-bold text-white">{introPost.hook}</h3>
                        </div>
                        <div>
                            <div className="text-xs font-bold text-zinc-500 mb-1">Текст</div>
                            <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{introPost.body}</p>
                        </div>
                        <div>
                            <div className="text-xs font-bold text-zinc-500 mb-1">Призыв (Soft CTA)</div>
                            <p className="text-sm text-indigo-400 font-medium">👉 {introPost.cta}</p>
                        </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-zinc-800 flex justify-end">
                        <button 
                            onClick={() => handleCopy(introPost)}
                            className={`px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${
                                copiedId === introPost.id 
                                    ? 'bg-green-600 text-white' 
                                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                            }`}
                        >
                            {copiedId === introPost.id ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                            {copiedId === introPost.id ? 'Скопировано!' : 'Копировать пост'}
                        </button>
                    </div>
                </div>
            </div>

            {/* SECTION 2: REGULAR FEED */}
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-zinc-400 uppercase text-xs tracking-wider">Регулярный контент (Лента)</h3>
                <button 
                    onClick={handleGenerateFeed}
                    className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-lg text-sm font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors shadow-sm"
                >
                    <RefreshCw size={16} /> Сгенерировать идеи
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {feedPosts.map((post) => (
                    <div key={post.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 flex flex-col h-full hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors relative group">
                        
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
                                <div className="text-xs font-bold text-zinc-400 mb-1">Заголовок</div>
                                <div className="font-bold text-zinc-900 dark:text-white text-sm leading-snug">
                                    {post.hook}
                                </div>
                            </div>
                            
                            <div>
                                <div className="text-xs font-bold text-zinc-400 mb-1">Ценность (Value)</div>
                                <div className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                                    {post.body}
                                </div>
                            </div>

                            <div>
                                <div className="text-xs font-bold text-zinc-400 mb-1">Действие</div>
                                <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                    👉 {post.cta}
                                </div>
                            </div>

                            <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800">
                                <div className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Визуал</div>
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
                                {copiedId === post.id ? 'Скопировано!' : 'Копировать'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
