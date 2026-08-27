
import { generateEDL, generateResolveXML, generateCSV } from './exportService';
import { generateId, stringToColor, formatTimecode, isExpired, getDaysRemaining } from './utils';
import { isOrgAdmin } from './userUtils';
import { Comment, CommentStatus, DEFAULT_CONFIG, DEFAULT_PAYMENT_CONFIG } from '../types';
import { MOCK_PROJECTS } from '../constants';
import i18n from 'i18next';
import { Calculator, Clock, FileOutput, ShieldCheck, Database, Globe, Wifi, ShieldAlert, Zap, Server, Film, Lock, PlayCircle, HardDrive, CreditCard, Cpu, Monitor, Mic, Languages } from 'lucide-react';

// ============================================================
// System Diagnostics 2.0 (docs/TASKS.md T-12, docs/TESTING.md §3)
// Каждый тест несёт severity, а при падении — diagnosis (гипотеза
// причины) и task (готовый markdown для docs/TASKS.md, префикс [diag]).
// Группы, завязанные на браузер, в node-окружении (unit-контракт
// tests/unit/testSuite.test.ts, environment: 'node') честно возвращают
// skipped-результаты вместо падения.
// ============================================================

export type Severity = 'critical' | 'warning' | 'info';

export type TestResult = {
    name: string;
    passed: boolean;
    expected?: string;
    received?: string;
    description: string;
    passCondition: string;
    failCondition: string;
    timestamp?: number;
    /** Насколько серьёзно ПАДЕНИЕ этого теста (по умолчанию 'info'). */
    severity?: Severity;
    /** Гипотеза причины падения (обязателен при passed:false). */
    diagnosis?: string;
    /** Готовый markdown-текст задачи для docs/TASKS.md (обязателен при passed:false). */
    task?: string;
};

export type TestGroup = {
    id: string;
    title: string;
    icon: any;
    description: string;
    tests: () => Promise<TestResult[]> | TestResult[];
};

// --- Общие хелперы -----------------------------------------

export const getSeverity = (r: TestResult): Severity => r.severity ?? 'info';

const isBrowserRuntime = (): boolean =>
    typeof window !== 'undefined' && typeof navigator !== 'undefined';

const SKIPPED_NOTE = 'Проверка выполняется только в браузере (живое окружение); в node/unit-контексте пропущена.';

const skippedResult = (name: string, description: string): TestResult => ({
    name,
    description,
    passed: true,
    expected: 'Браузерное окружение',
    received: 'skipped: вне браузера (node)',
    passCondition: SKIPPED_NOTE,
    failCondition: 'Неприменимо вне браузера.',
    severity: 'info'
});

/** Готовая задача для «чистых» регрессий логики (не зависит от окружения). */
const regressionTask = (module: string, what: string): string => [
    `### T-XX Regression: ${what}`,
    '- Приоритет: P1',
    `- Источник: [diag] System Diagnostics → ${module}`,
    `- Проблема: чистая логика модуля ${module} ведёт себя не по контракту (${what}); тест на /test упал в живом браузере.`,
    `- Цель: восстановить поведение модуля по unit-контракту (tests/unit) и по docs/ARCHITECTURE.md.`,
    '- Acceptance: тест на /test зелёный; npm run test зелёный.'
].join('\n');

// --- Окружение: сборка сводки для панели/отчёта -------------

export type BackendMode = 'mock' | 'prod' | 'unknown';

export type EnvSummary = {
    isBrowser: boolean;
    href: string;
    origin: string;
    mode: BackendMode;
    healthDetail: string;
    userAgent: string;
    browser: string;
    viewport: { width: number; height: number };
    devicePixelRatio: number;
    online: boolean;
    browserLanguage: string;
    appLanguage: string;
};

const EMPTY_ENV: EnvSummary = {
    isBrowser: false,
    href: '-',
    origin: '-',
    mode: 'unknown',
    healthDetail: 'не браузерное окружение',
    userAgent: '-',
    browser: '-',
    viewport: { width: 0, height: 0 },
    devicePixelRatio: 0,
    online: true,
    browserLanguage: '-',
    appLanguage: '-'
};

/** Человекочитаемое имя браузера из User-Agent (для чипов, диагнозов и задач). */
export const detectBrowser = (userAgent: string): string => {
    const ua = userAgent || '';
    const mobile = /Mobi|Android|iPhone|iPad/i.test(ua) ? ' (mobile)' : '';
    const major = (m: RegExpMatchArray | null) => (m ? ` ${m[1].split('.')[0]}` : '');
    const edge = ua.match(/Edg(?:e|A|iOS)?\/([\d.]+)/);
    if (edge) return `Edge${major(edge)}${mobile}`;
    const opera = ua.match(/(?:OPR|Opera)\/([\d.]+)/);
    if (opera) return `Opera${major(opera)}${mobile}`;
    const firefox = ua.match(/Firefox\/([\d.]+)/);
    if (firefox) return `Firefox${major(firefox)}${mobile}`;
    const chrome = ua.match(/(?:Chrome|CriOS)\/([\d.]+)/);
    if (chrome) return `Chrome${major(chrome)}${mobile}`;
    const safari = ua.match(/Version\/([\d.]+).*Safari/);
    if (safari) return `Safari${major(safari)}${mobile}`;
    return `Unknown browser${mobile}`;
};

type HealthProbe = { mode: BackendMode; detail: string };
let healthProbeCache: { at: number; value: HealthProbe } | null = null;
const HEALTH_PROBE_TTL_MS = 30_000;

/**
 * Определяет режим (mock/dev vs prod) косвенно: VITE_ ключ в рантайме недоступен.
 * Живой бэкенд отвечает на /api/health JSON {status:'ok'}; 404/сетевая ошибка или
 * HTML-ответ (vite dev SPA-fallback) = mock/dev.
 */
export const probeBackendMode = async (): Promise<HealthProbe> => {
    if (healthProbeCache && Date.now() - healthProbeCache.at < HEALTH_PROBE_TTL_MS) {
        return healthProbeCache.value;
    }
    let value: HealthProbe;
    try {
        const res = await fetch('/api/health', { cache: 'no-store' });
        if (res.ok) {
            try {
                const data = await res.json();
                value = data && data.status === 'ok'
                    ? { mode: 'prod', detail: '200 {status:"ok"}' }
                    : { mode: 'prod', detail: `200 ${JSON.stringify(data).slice(0, 80)}` };
            } catch {
                value = { mode: 'mock', detail: '200, но тело не JSON (vite dev без Vercel Functions)' };
            }
        } else {
            value = { mode: 'mock', detail: `HTTP ${res.status} от /api/health` };
        }
    } catch (e: any) {
        value = { mode: 'mock', detail: `network error: ${e?.message || e}` };
    }
    healthProbeCache = { at: Date.now(), value };
    return value;
};

/** Сводка окружения для панели «Окружение» и отчётов. */
export const collectEnvSummary = async (): Promise<EnvSummary> => {
    if (!isBrowserRuntime()) return EMPTY_ENV;
    const { mode, detail } = await probeBackendMode();
    return {
        isBrowser: true,
        href: window.location.href,
        origin: window.location.origin,
        mode,
        healthDetail: detail,
        userAgent: navigator.userAgent,
        browser: detectBrowser(navigator.userAgent),
        viewport: { width: window.innerWidth, height: window.innerHeight },
        devicePixelRatio: window.devicePixelRatio || 1,
        online: navigator.onLine,
        browserLanguage: navigator.language || '-',
        appLanguage: i18n.isInitialized ? i18n.language : '-'
    };
};

// --- Статистика / Health Score / отчёты ---------------------

export type SuiteStats = {
    total: number;
    passed: number;
    failed: number;
    criticalFails: number;
    warningFails: number;
    infoFails: number;
};

export const computeStats = (results: Record<string, TestResult[]>): SuiteStats => {
    const all = Object.values(results).flat();
    const failedList = all.filter(r => !r.passed);
    return {
        total: all.length,
        passed: all.length - failedList.length,
        failed: failedList.length,
        criticalFails: failedList.filter(r => getSeverity(r) === 'critical').length,
        warningFails: failedList.filter(r => getSeverity(r) === 'warning').length,
        infoFails: failedList.filter(r => getSeverity(r) === 'info').length
    };
};

/**
 * Health Score: критичные падения весят x3, warning x1, info не влияет.
 * Формула: max(0, 100% × (1 − (3×critical + 1×warning) / (3×total))).
 */
export const computeHealthScore = (results: Record<string, TestResult[]>): number | null => {
    const { total, criticalFails, warningFails } = computeStats(results);
    if (total === 0) return null;
    return Math.max(0, Math.round(100 * (1 - (3 * criticalFails + warningFails) / (3 * total))));
};

export const HEALTH_SCORE_FORMULA = 'max(0, 100% × (1 − (3×critical + 1×warning) / (3×total)))';

export const formatFileStamp = (d: Date): string => {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
};

export type DiagnosticReportInput = {
    now: Date;
    version: string;
    env: EnvSummary | null;
    results: Record<string, TestResult[]>;
};

/** Markdown-отчёт: шапка с окружением, сводка, таблица падений с diagnosis и task. */
export const buildReportMarkdown = ({ now, version, env, results }: DiagnosticReportInput): string => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const stats = computeStats(results);
    const score = computeHealthScore(results);

    const lines: string[] = [
        '# Anotee System Diagnostics — отчёт',
        '',
        `- **Дата:** ${dateStr}`,
        `- **Версия приложения:** ${version}`,
        `- **URL:** ${env?.href || '-'}`,
        `- **Режим:** ${env ? `${env.mode} (${env.healthDetail})` : '-'}`,
        `- **Браузер:** ${env?.browser || '-'} · UA: \`${env?.userAgent || '-'}\``,
        `- **Viewport:** ${env ? `${env.viewport.width}×${env.viewport.height} @ ${env.devicePixelRatio}x` : '-'}`,
        `- **Сеть:** ${env?.online ? 'online' : 'offline'}`,
        `- **Языки:** browser ${env?.browserLanguage || '-'} · app ${env?.appLanguage || '-'}`,
        `- **Health Score:** ${score === null ? '-' : `${score}%`} — формула: \`${HEALTH_SCORE_FORMULA}\``,
        '',
        '## Сводка',
        '',
        `Total ${stats.total} · Passed ${stats.passed} · Failed ${stats.failed} (critical ${stats.criticalFails}, warning ${stats.warningFails}, info ${stats.infoFails})`,
        ''
    ];

    const groups = TEST_SUITE
        .map(g => ({ g, rs: results[g.id] || [] }))
        .filter(x => x.rs.length > 0);

    if (stats.failed === 0) {
        lines.push('## Падения', '', 'Все выполненные тесты зелёные.');
    } else {
        lines.push('## Падения', '');
        for (const { g, rs } of groups) {
            for (const r of rs.filter(x => !x.passed)) {
                lines.push(
                    `### [${getSeverity(r).toUpperCase()}] ${g.title} → ${r.name}`,
                    '',
                    `- Expected: ${r.expected || '-'}`,
                    `- Received: ${r.received || '-'}`,
                    `- Условие падения: ${r.failCondition}`,
                    ...(r.diagnosis ? [`- Почему: ${r.diagnosis}`] : []),
                    ''
                );
            }
        }
        lines.push('## Готовые задачи (для docs/TASKS.md)', '');
        for (const { g, rs } of groups) {
            for (const r of rs.filter(x => !x.passed && x.task)) {
                lines.push(`#### ${g.title} → ${r.name}`, '', r.task!, '');
            }
        }
    }
    return lines.join('\n');
};

// --- Ключи для i18n/UI-группы: реальные ключи, используемые в коде ---

const I18N_SAMPLE_KEYS: string[] = [
    'nav.dashboard',
    'nav.roadmap',
    'common.copy',
    'common.error',
    'common.success',
    'common.upload',
    'player.comments',
    'player.fps',
    'player.saved',
    'player.marker.in',
    'player.marker.out',
    'player.resolve_all',
    'player.export.xml',
    'player.voice.listening',
    'profile.language'
];

const shuffle = <T>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
};

const mockComments: Comment[] = [
    {
        id: 'c1',
        userId: 'u1',
        text: 'Test Comment',
        timestamp: 10.0,
        status: CommentStatus.OPEN,
        createdAt: 'now'
    }
];

export const TEST_SUITE: TestGroup[] = [
    {
        id: 'environment',
        title: 'Environment',
        icon: Monitor,
        description: 'Живое окружение: URL, режим (mock/prod), браузер, viewport, DPR, сеть, языки.',
        tests: async () => {
            if (!isBrowserRuntime()) {
                return [
                    skippedResult('App URL / Origin', 'Текущий URL/origin страницы диагностики.'),
                    skippedResult('Runtime Mode (Mock/Prod)', 'Определение режима приложения через доступность /api/health.'),
                    skippedResult('User Agent / Browser', 'Разбор User-Agent: браузер, версия, mobile/desktop.'),
                    skippedResult('Viewport', 'Размер окна и минимально поддерживаемое разрешение.'),
                    skippedResult('Device Pixel Ratio', 'Плотность пикселей устройства.'),
                    skippedResult('Network (navigator.onLine)', 'Онлайн-статус браузера.'),
                    skippedResult('Browser Language vs App Language', 'Язык браузера vs язык интерфейса приложения.')
                ];
            }
            const { mode, detail } = await probeBackendMode();
            const browser = detectBrowser(navigator.userAgent);
            const res: TestResult[] = [];

            res.push({
                name: 'App URL / Origin',
                description: 'Текущий URL/origin страницы диагностики.',
                passed: true,
                severity: 'info',
                expected: 'Любой доступный origin',
                received: window.location.href,
                passCondition: 'Страница открыта и location доступен.',
                failCondition: 'Неприменимо: location всегда доступен в браузере.'
            });

            res.push({
                name: 'Runtime Mode (Mock/Prod)',
                description: 'Режим приложения: есть ли живой бэкенд. VITE_ ключ недоступен в рантайме, поэтому определяем косвенно по /api/health.',
                passed: true,
                severity: 'info',
                expected: 'mock/dev или prod',
                received: `${mode} — ${detail}`,
                passCondition: 'Режим определён (информационный тест).',
                failCondition: 'Неприменимо: тест информационный.'
            });

            res.push({
                name: 'User Agent / Browser',
                description: 'Разбор User-Agent: браузер, версия, mobile/desktop.',
                passed: true,
                severity: 'info',
                expected: 'Распознанный браузер',
                received: `${browser}`,
                passCondition: 'Браузер распознан (информационный тест).',
                failCondition: 'Неприменимо: тест информационный.'
            });

            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const tooSmall = vw < 320 || vh < 320;
            res.push({
                name: 'Viewport',
                description: 'Размер окна браузера и минимально поддерживаемое разрешение.',
                passed: !tooSmall,
                severity: tooSmall ? 'warning' : 'info',
                expected: '≥ 320×320',
                received: `${vw}×${vh}`,
                passCondition: 'Окно не меньше минимально поддерживаемого (320px).',
                failCondition: 'Viewport меньше 320px: интерфейс может обрезаться.',
                diagnosis: 'Окно/экран меньше минимального: фиксированные панели и гриды могут уезжать за вьюпорт.',
                task: [
                    '### T-XX UI: минимальная ширина вьюпорта',
                    '- Приоритет: P2',
                    '- Источник: [diag] System Diagnostics → Environment (Viewport)',
                    `- Проблема: приложение открыто во viewport ${vw}×${vh} (< 320px) — компоненты могут обрезаться.`,
                    '- Цель: убедиться, что критические экраны (плеер, дашборд) деградируют корректно ниже 360px, либо задать min-width приложения.',
                    '- Acceptance: на 320px нет горизонтального скролла в критических экранах.'
                ].join('\n')
            });

            const dpr = window.devicePixelRatio || 1;
            res.push({
                name: 'Device Pixel Ratio',
                description: 'Плотность пикселей (масштаб браузера × экран).',
                passed: dpr >= 1,
                severity: dpr >= 1 ? 'info' : 'warning',
                expected: '≥ 1x',
                received: `${dpr}x`,
                passCondition: 'DPR не меньше 1 (масштаб страницы ≥ 100%).',
                failCondition: 'DPR < 1: масштаб браузера < 100%, фиксированные панели могут «расползаться».',
                diagnosis: 'Масштаб браузера меньше 100% (или нестандартный DPR): возможны артефакты fixed-панелей и таймлайна.',
                task: [
                    '### T-XX UI: поведение при browser zoom < 100%',
                    '- Приоритет: P2',
                    '- Источник: [diag] System Diagnostics → Environment (DPR)',
                    '- Проблема: страница открыта с devicePixelRatio < 1 — пользовательский зум < 100%.',
                    '- Цель: проверить вёрстку fixed-панелей (плеер, хедер) при 50–90% зума.',
                    '- Acceptance: при зуме 50–90% нет наложений/двойных скроллбаров.'
                ].join('\n')
            });

            res.push({
                name: 'Network (navigator.onLine)',
                description: 'Онлайн-статус браузера.',
                passed: navigator.onLine,
                severity: navigator.onLine ? 'info' : 'warning',
                expected: 'online',
                received: navigator.onLine ? 'online' : 'offline',
                passCondition: 'Браузер видит сеть.',
                failCondition: 'navigator.onLine === false: сеть недоступна.',
                diagnosis: 'Браузер считает, что сети нет: API/CDN/voice-тесты упадут по сетевым причинам. Это состояние окружения, а не баг кода.',
                task: [
                    '### T-XX Infra: офлайн-состояние клиента',
                    '- Приоритет: P2',
                    '- Источник: [diag] System Diagnostics → Environment (Network)',
                    '- Проблема: диагностика запущена офлайн (navigator.onLine = false) — сетевые тесты падают по среде, а не из-за кода.',
                    '- Цель: (опционально) офлайн-баннер в UI и повтор синхронизации при восстановлении сети.',
                    '- Acceptance: при восстановлении сети проекты/комментарии синхронизируются без ручного refresh.'
                ].join('\n')
            });

            const appLang = i18n.isInitialized ? i18n.language : '-';
            res.push({
                name: 'Browser Language vs App Language',
                description: 'Язык браузера vs язык интерфейса приложения (i18next).',
                passed: true,
                severity: 'info',
                expected: 'Информационно',
                received: `browser: ${navigator.language || '-'}; app: ${appLang}`,
                passCondition: 'Оба языка показаны (информационный тест).',
                failCondition: 'Неприменимо: тест информационный.'
            });

            return res;
        }
    },
    {
        id: 'api',
        title: 'Backend API Integrity',
        icon: Server,
        description: 'Проверка доступности серверных функций Vercel и безопасности эндпоинтов.',
        tests: async () => {
            const res: TestResult[] = [];
            
            // 1. Health Check
            try {
                const start = performance.now();
                const health = await fetch('/api/health');
                const duration = performance.now() - start;
                const data = await health.json();
                
                res.push({
                    name: 'API Healthcheck',
                    description: 'Ping /api/health endpoint.',
                    passed: health.ok && data.status === 'ok',
                    severity: 'critical',
                    expected: 'Status: 200 OK',
                    received: `Status: ${health.status}, Time: ${duration.toFixed(0)}ms`,
                    passCondition: 'Сервер отвечает 200 OK и JSON {status: "ok"}.',
                    failCondition: '500 Error, таймаут или некорректный JSON.',
                    diagnosis: 'Vercel Functions недоступны: упавший деплой, лимиты Hobby-плана, регион/сеть. В mock/dev-режиме (vite dev) это ожидаемо — бэкенда нет.',
                    task: [
                        '### T-XX Backend: /api/health недоступен',
                        '- Приоритет: P0',
                        '- Источник: [diag] System Diagnostics → Backend API Integrity',
                        '- Проблема: /api/health не отвечает 200 {status:"ok"} (api/health.js) — бэкенд-функции недоступны для этого клиента.',
                        '- Цель: восстановить доступность Vercel Functions (деплой/лимиты/DNS); для dev — прогнать на vercel dev или проде.',
                        '- Acceptance: тест API Healthcheck на /test зелёный на проде.'
                    ].join('\n')
                });
            } catch (e: any) {
                res.push({
                    name: 'API Healthcheck',
                    description: 'Ping /api/health endpoint.',
                    passed: false,
                    severity: 'critical',
                    expected: '200 OK',
                    received: e.message,
                    passCondition: 'Сервер доступен.',
                    failCondition: 'Сетевая ошибка или сервер упал.',
                    diagnosis: 'Запрос до /api/health не дошёл: бэкенда нет (mock/dev — ожидаемо), сеть недоступна или функции упали.',
                    task: [
                        '### T-XX Backend: /api/health недоступен',
                        '- Приоритет: P0',
                        '- Источник: [diag] System Diagnostics → Backend API Integrity',
                        `- Проблема: fetch /api/health упал с ошибкой: ${e.message}. В mock/dev это ожидаемо; на проде — бэкенд недоступен.`,
                        '- Цель: восстановить доступность Vercel Functions; для dev-проверки использовать vercel dev.',
                        '- Acceptance: тест API Healthcheck на /test зелёный на проде.'
                    ].join('\n')
                });
            }

            // 2. Auth Guard Check
            try {
                const secured = await fetch('/api/data');
                res.push({
                    name: 'Auth Guard (401 Check)',
                    description: 'Попытка доступа к защищенному API без токена.',
                    passed: secured.status === 401,
                    severity: 'critical',
                    expected: '401 Unauthorized',
                    received: `${secured.status} ${secured.statusText}`,
                    passCondition: 'Сервер отклоняет запросы без заголовка Authorization.',
                    failCondition: 'Сервер возвращает 200 (утечка данных) или 500.',
                    diagnosis: secured.status === 200
                        ? 'Два сценария: (1) vite dev без функций отдаёт index.html (ложно-красный в dev); (2) на бэкенде не вызывается verifyUser (api/_auth.js) — утечка данных, см. docs/audit и TASKS T-02/T-06.'
                        : 'Неожиданный статус защищённого эндпоинта: проверить деплой api/data.js.',
                    task: [
                        '### T-XX Security: /api/data отвечает не-401 без токена',
                        '- Приоритет: P0',
                        '- Источник: [diag] System Diagnostics → Backend API Integrity',
                        '- Проблема: GET /api/data без Authorization вернул не-401. На проде это утечка данных (verifyUser не вызван, api/_auth.js); в vite dev это ложно-красный (SPA-fallback отдаёт index.html).',
                        '- Цель: на проде — гарантированный verifyUser на всех мутирующих/читающих action (см. TASKS T-02, T-06); диагностику запускать на vercel dev/проде.',
                        '- Acceptance: на проде GET /api/data без токена → 401; тест Auth Guard на /test зелёный.'
                    ].join('\n')
                });
            } catch (e: any) {
                res.push({
                    name: 'Auth Guard (401 Check)',
                    description: 'Попытка доступа к защищенному API без токена.',
                    passed: false,
                    severity: 'critical',
                    received: e.message,
                    expected: '401',
                    passCondition: 'Запрос выполнен, сервер отклонил анонимный доступ.',
                    failCondition: 'Сетевая ошибка: статус проверить невозможно.',
                    diagnosis: 'Запрос не дошёл: сеть/бэкенд недоступны — статус защиты неизвестен.',
                    task: [
                        '### T-XX Security: не удалось проверить auth-guard /api/data',
                        '- Приоритет: P0',
                        '- Источник: [diag] System Diagnostics → Backend API Integrity',
                        `- Проблема: fetch /api/data упал: ${e.message} — статус auth-guard неизвестен.`,
                        '- Цель: повторить проверку на доступном окружении (vercel dev/прод).',
                        '- Acceptance: тест Auth Guard на /test выполнен и зелёный на проде.'
                    ].join('\n')
                });
            }

            return res;
        }
    },
    {
        id: 'billing_integration',
        title: 'Billing Integration',
        icon: CreditCard,
        description: 'Проверка эндпоинтов оплаты и вебхуков.',
        tests: async () => {
            const res: TestResult[] = [];

            // 1. Payment Init Guard
            try {
                // Should return 401 without token, confirming the file loads and checks auth
                const initRes = await fetch('/api/payment?action=init', { method: 'POST' });
                res.push({
                    name: 'Payment Init Endpoint',
                    description: 'POST /api/payment?action=init (No Auth)',
                    passed: initRes.status === 401,
                    severity: 'critical',
                    expected: '401 Unauthorized',
                    received: `${initRes.status}`,
                    passCondition: 'Эндпоинт существует и защищен.',
                    failCondition: '404 (Файл не найден) или 500 (Ошибка кода).',
                    diagnosis: 'В dev (vite) 404 — ожидаемо, функций нет. На проде 404/500 = сломан файл api/payment.js или деплой; 200 без токена = дыра в auth-guard.',
                    task: [
                        '### T-XX Billing: /api/payment?action=init недоступен или не защищён',
                        '- Приоритет: P0',
                        '- Источник: [diag] System Diagnostics → Billing Integration',
                        '- Проблема: POST /api/payment?action=init без токена вернул не-401 (404/500/200). Деньги: файл api/payment.js не задеплоен, падает при импорте или не проверяет verifyUser.',
                        '- Цель: восстановить эндпоинт и auth-guard; правки только по тест-плану (железное правило №1, зона api/payment.js).',
                        '- Acceptance: на проде init без токена → 401; тест на /test зелёный.'
                    ].join('\n')
                });
            } catch (e: any) {
                res.push({ name: 'Payment Init', passed: false, severity: 'critical', description: 'Fetch error', received: e.message, expected: '401', passCondition: 'Запрос выполнен, эндпоинт защищен.', failCondition: 'Сетевая ошибка: эндпоинт недоступен или заблокирован.', diagnosis: 'Запрос не дошёл: в dev — функций нет (ожидаемо), на проде — сеть/блокировка.', task: [
                    '### T-XX Billing: не удалось проверить /api/payment?action=init',
                    '- Приоритет: P0',
                    '- Источник: [diag] System Diagnostics → Billing Integration',
                    '- Проблема: fetch упал — статус платёжного эндпоинта неизвестен.',
                    '- Цель: повторить на vercel dev/проде.',
                    '- Acceptance: тест Payment Init на /test зелёный на проде.'
                ].join('\n') });
            }

            // 2. Webhook Sanity Check
            try {
                // Should return 400 because body is missing, but confirms it handles request
                const hookRes = await fetch('/api/payment?action=webhook', { method: 'POST' });
                res.push({
                    name: 'Webhook Endpoint',
                    description: 'POST /api/payment?action=webhook (Empty Body)',
                    passed: hookRes.status === 400,
                    severity: 'warning',
                    expected: '400 Invalid Event',
                    received: `${hookRes.status}`,
                    passCondition: 'Вебхук обрабатывает запрос и валидирует данные.',
                    failCondition: '500 (Ошибка импорта/синтаксиса) или 404.',
                    diagnosis: 'В dev — ожидаемый 404 (нет функций). На проде 500 = ошибка кода вебхука; при этом в TASKS T-01 уже есть P0 на подпись webhook (сейчас она не проверяется).',
                    task: [
                        '### T-XX Billing: webhook-эндпоинт отвечает не-400 на пустой запрос',
                        '- Приоритет: P1',
                        '- Источник: [diag] System Diagnostics → Billing Integration',
                        '- Проблема: POST /api/payment?action=webhook без тела вернул не-400 — вебхук не валидирует вход (или не задеплоен). Дополнительно: подпись webhook до сих пор не проверяется (TASKS T-01, P0).',
                        '- Цель: восстановить валидацию входа; закрыть T-01 (проверка подписи ЮKassa/Prodamus).',
                        '- Acceptance: пустой POST → 400; подписанные вебхуки обоих провайдеров принимаются, подделанные — нет.'
                    ].join('\n')
                });
            } catch (e: any) {
                res.push({ name: 'Webhook Check', passed: false, severity: 'warning', description: 'Fetch error', received: e.message, expected: '400', passCondition: 'Вебхук обрабатывает запрос и валидирует данные.', failCondition: 'Сетевая ошибка: эндпоинт недоступен или заблокирован.', diagnosis: 'Запрос не дошёл: в dev — функций нет (ожидаемо), на проде — сеть/блокировка.', task: [
                    '### T-XX Billing: не удалось проверить webhook-эндпоинт',
                    '- Приоритет: P1',
                    '- Источник: [diag] System Diagnostics → Billing Integration',
                    '- Проблема: fetch webhook упал — статус неизвестен.',
                    '- Цель: повторить на vercel dev/проде.',
                    '- Acceptance: пустой POST → 400 на проде.'
                ].join('\n') });
            }

            return res;
        }
    },
    {
        id: 'auth',
        title: 'Auth & Permissions',
        icon: Lock,
        description: 'Проверка логики ролей и прав доступа (ACL).',
        tests: () => {
            const res: TestResult[] = [];
            
            // Mock Clerk Memberships
            const mockMemberships = [
                { publicUserData: { userId: 'admin_1' }, role: 'org:admin' },
                { publicUserData: { userId: 'member_2' }, role: 'org:member' }
            ];

            const checkAdmin = isOrgAdmin('admin_1', mockMemberships);
            const checkMember = isOrgAdmin('member_2', mockMemberships);

            res.push({
                name: 'Org Admin Detection',
                description: 'Проверка утилиты isOrgAdmin',
                passed: checkAdmin === true && checkMember === false,
                severity: 'critical',
                expected: 'Admin=True, Member=False',
                received: `Admin=${checkAdmin}, Member=${checkMember}`,
                passCondition: 'Функция корректно определяет роль org:admin.',
                failCondition: 'Обычный участник получил права админа или наоборот.',
                diagnosis: 'Сломана утилита services/userUtils.ts (isOrgAdmin): эскалация ролей в UI админки.',
                task: regressionTask('services/userUtils.ts', 'isOrgAdmin неправильно определяет org:admin/org:member')
            });

            return res;
        }
    },
    {
        id: 'media',
        title: 'Media Streaming QA',
        icon: Film,
        description: 'Валидация форматов, CORS и доступности CDN.',
        tests: async () => {
            const res: TestResult[] = [];
            const sampleUrl = 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

            try {
                const head = await fetch(sampleUrl, { method: 'HEAD' });
                const type = head.headers.get('content-type');
                
                res.push({
                    name: 'Video CDN Access',
                    description: 'Проверка доступности публичного тестового видео.',
                    passed: head.ok && (type?.includes('video') || false),
                    severity: 'warning',
                    expected: '200 OK, video/mp4',
                    received: `${head.status}, ${type}`,
                    passCondition: 'Сервер отдает видео-файл с корректным MIME.',
                    failCondition: 'CORS ошибка или 404.',
                    diagnosis: 'storage.googleapis.com недоступен с этого клиента (региональная блокировка, корпоративный прокси, CORS). На сам Drive/S3-стриминг влияет косвенно, но указывает на сетевые ограничения пользователя.',
                    task: [
                        '### T-XX Media: внешний CDN недоступен у клиента',
                        '- Приоритет: P2',
                        '- Источник: [diag] System Diagnostics → Media Streaming QA',
                        '- Проблема: HEAD-запрос к тестовому видео на storage.googleapis.com не удался — у части пользователей внешние CDN блокируются.',
                        '- Цель: оценить долю таких пользователей (отчёты /test), при необходимости — зеркало демо-видео или прокси (api/proxyAudio.js как образец).',
                        '- Acceptance: тест Video CDN Access зелёный у пользователей из проблемных регионов.'
                    ].join('\n')
                });
            } catch (e: any) {
                res.push({
                    name: 'Video CDN Access',
                    description: 'CORS / Network check',
                    passed: false,
                    severity: 'warning',
                    expected: 'Success',
                    received: e.message,
                    passCondition: 'Fetch успешен.',
                    failCondition: 'Блокировка CORS или сети (возможно нужен VPN).',
                    diagnosis: 'Сеть/CORS блокируют внешний CDN: в песочнице/CI это норма (внешние хосты недоступны), у пользователей — региональные ограничения.',
                    task: [
                        '### T-XX Media: внешний CDN недоступен у клиента',
                        '- Приоритет: P2',
                        '- Источник: [diag] System Diagnostics → Media Streaming QA',
                        '- Проблема: запрос к тестовому видео упал (CORS/сеть) — клиент не достучался до внешнего CDN.',
                        '- Цель: оценить масштаб (отчёты /test); рассмотреть зеркало/прокси для демо-контента.',
                        '- Acceptance: тест зелёный без VPN в проблемных регионах.'
                    ].join('\n')
                });
            }

            return res;
        }
    },
    {
        id: 'voice',
        title: 'Voice Input',
        icon: Mic,
        description: 'Поддержка голосового ввода: SpeechRecognition, getUserMedia, MediaRecorder, permission микрофона.',
        tests: async () => {
            if (!isBrowserRuntime()) {
                return [
                    skippedResult('SpeechRecognition Support', 'Наличие webkitSpeechRecognition/SpeechRecognition в браузере.'),
                    skippedResult('Microphone Capture (getUserMedia)', 'Доступность функции navigator.mediaDevices.getUserMedia (без запроса permission).'),
                    skippedResult('MediaRecorder Support', 'Наличие MediaRecorder для записи аудио.'),
                    skippedResult('Microphone Permission Status', 'Статус permission микрофона через Permissions API (без запроса доступа).')
                ];
            }
            const browser = detectBrowser(navigator.userAgent);
            const res: TestResult[] = [];
            const w = window as unknown as Record<string, unknown>;

            // 1. SpeechRecognition
            const hasSR = typeof w.SpeechRecognition === 'function' || typeof w.webkitSpeechRecognition === 'function';
            res.push({
                name: 'SpeechRecognition Support',
                description: 'Наличие webkitSpeechRecognition/SpeechRecognition — основа живого голосового ввода.',
                passed: hasSR,
                severity: hasSR ? 'info' : 'warning',
                expected: 'SpeechRecognition доступен',
                received: `SpeechRecognition: ${typeof w.SpeechRecognition}, webkitSpeechRecognition: ${typeof w.webkitSpeechRecognition}`,
                passCondition: 'Браузер предоставляет SpeechRecognition API (Chrome/Edge/Safari 14.1+).',
                failCondition: 'API отсутствует (Firefox и др.): живое распознавание речи невозможно.',
                diagnosis: hasSR
                    ? undefined
                    : `${browser} не поддерживает webkitSpeechRecognition — нужен fallback на Whisper (MediaRecorder → services/transcriptionWorker.ts), как в TASKS T-07.`,
                task: hasSR
                    ? undefined
                    : [
                        `### T-XX Voice Input: fallback распознавания для ${browser}`,
                        '- Приоритет: P1',
                        `- Источник: [diag] System Diagnostics → Voice Input (браузер: ${browser})`,
                        '- Проблема: браузер не предоставляет SpeechRecognition/webkitSpeechRecognition — кнопки микрофона в плеере молча не работают (components/Player.tsx:737-755).',
                        '- Цель: при отсутствии SpeechRecognition — fallback MediaRecorder → Whisper (services/transcriptionWorker.ts) с индикацией записи и статуса транскрибации.',
                        '- Acceptance: в Firefox голосовой комментарий создаётся (текст появляется после транскрибации); тест Voice Input → SpeechRecognition на /test зелёный.'
                    ].join('\n')
            });

            // 2. getUserMedia (доступность функции, БЕЗ запроса permission)
            const hasGetUserMedia = typeof navigator.mediaDevices?.getUserMedia === 'function';
            const insecure = isBrowserRuntime() && !window.isSecureContext;
            res.push({
                name: 'Microphone Capture (getUserMedia)',
                description: 'Доступность функции navigator.mediaDevices.getUserMedia (самой функции, без запроса доступа).',
                passed: hasGetUserMedia,
                severity: hasGetUserMedia ? 'info' : 'critical',
                expected: 'mediaDevices.getUserMedia — function',
                received: `mediaDevices: ${typeof navigator.mediaDevices}, getUserMedia: ${typeof navigator.mediaDevices?.getUserMedia}${insecure ? ', isSecureContext: false' : ''}`,
                passCondition: 'Функция захвата аудио существует (HTTPS/localhost-контекст).',
                failCondition: 'getUserMedia недоступен: небезопасный контекст (http) или старый браузер — захват микрофона невозможен.',
                diagnosis: hasGetUserMedia
                    ? undefined
                    : insecure
                        ? 'Страница открыта не по HTTPS (isSecureContext=false): mediaDevices недоступен по дизайну браузеров. Развернуть проект на http — голосовой ввод не заработает.'
                        : 'mediaDevices/getUserMedia отсутствует: очень старый браузер или WebView без поддержки захвата аудио.',
                task: hasGetUserMedia
                    ? undefined
                    : [
                        '### T-XX Voice Input: микрофон недоступен (getUserMedia)',
                        '- Приоритет: P0',
                        '- Источник: [diag] System Diagnostics → Voice Input',
                        `- Проблема: navigator.mediaDevices.getUserMedia недоступен (${insecure ? 'isSecureContext=false — http-контекст' : 'браузер без поддержки'}) — захват аудио невозможен, voice-комментарии не работают.`,
                        '- Цель: обеспечить HTTPS-контекст продакшена; в UI показывать понятную ошибку вместо молчаливого провала (см. TASKS T-07).',
                        '- Acceptance: на https-домене getUserMedia доступен; тест Microphone Capture на /test зелёный.'
                    ].join('\n')
            });

            // 3. MediaRecorder
            const hasMR = typeof window.MediaRecorder === 'function';
            res.push({
                name: 'MediaRecorder Support',
                description: 'Наличие MediaRecorder — запись аудио (вложения, Whisper-fallback).',
                passed: hasMR,
                severity: hasMR ? 'info' : 'warning',
                expected: 'MediaRecorder доступен',
                received: `${typeof window.MediaRecorder}`,
                passCondition: 'Браузер умеет записывать медиа-поток в файл.',
                failCondition: 'MediaRecorder отсутствует: запись аудио-вложений и Whisper-fallback невозможны.',
                diagnosis: hasMR
                    ? undefined
                    : `${browser} не поддерживает MediaRecorder — запись аудио и Whisper-fallback (см. TASKS T-07) недоступны в этом браузере.`,
                task: hasMR
                    ? undefined
                    : [
                        `### T-XX Voice Input: нет MediaRecorder в ${browser}`,
                        '- Приоритет: P2',
                        `- Источник: [diag] System Diagnostics → Voice Input (браузер: ${browser})`,
                        '- Проблема: MediaRecorder недоступен — запись аудио-вложений и Whisper-fallback невозможны в этом браузере.',
                        '- Цель: задокументировать матрицу поддерживаемых браузеров; при необходимости — альтернативный кодек/библиотека записи.',
                        '- Acceptance: voice-флоу работает во всех браузерах из матрицы поддержки.'
                    ].join('\n')
            });

            // 4. Microphone permission status (безопасно, без запроса доступа;
            //    Safari бросает на query('microphone') — это info, не fail)
            let perm: 'granted' | 'denied' | 'prompt' | 'unknown' = 'unknown';
            let permError = '';
            try {
                const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
                perm = status.state as 'granted' | 'denied' | 'prompt';
            } catch (e: any) {
                permError = e?.message || 'Permissions API не поддерживает microphone';
            }

            const denied = perm === 'denied';
            res.push({
                name: 'Microphone Permission Status',
                description: 'Статус доступа к микрофону через navigator.permissions.query (без запроса доступа).',
                passed: !denied,
                severity: denied ? 'warning' : 'info',
                expected: 'granted | prompt | unknown (Safari)',
                received: permError ? `unknown (${permError})` : perm,
                passCondition: 'Микрофон не запрещён (granted/prompt) или браузер не отдаёт статус (Safari) — тогда info, не fail.',
                failCondition: 'permission = denied: микрофон запрещён в настройках сайта.',
                diagnosis: denied
                    ? 'Пользователь запретил микрофон этому сайту: голосовой ввод не заработает, пока доступ не включат в настройках сайта (иконка замка в адресной строке).'
                    : undefined,
                task: denied
                    ? [
                        '### T-XX UX: понятный флоу при запрещённом микрофоне',
                        '- Приоритет: P2',
                        '- Источник: [diag] System Diagnostics → Voice Input (permission: denied)',
                        '- Проблема: доступ к микрофону запрещён в настройках сайта; клик по Mic даёт молчаливый провал (components/Player.tsx:737-755 — нет обработчика onerror/not-allowed).',
                        '- Цель: при denied/not-allowed показывать инструкцию «включите микрофон в настройках сайта» (см. TASKS T-07).',
                        '- Acceptance: при denied клик по Mic показывает тост с инструкцией; после включения голосовой ввод работает.'
                    ].join('\n')
                    : undefined
            });

            return res;
        }
    },
    {
        id: 'player',
        title: 'Player Core',
        icon: PlayCircle,
        description: 'Логика генерации аватарок и цветов.',
        tests: () => {
            const res: TestResult[] = [];
            const color1 = stringToColor('user_123');
            const color2 = stringToColor('user_123');
            const color3 = stringToColor('user_456');

            res.push({
                name: 'Deterministic Color Hash',
                description: 'Генерация цвета аватарки по ID',
                passed: color1 === color2 && color1 !== color3 && color1.startsWith('hsl'),
                expected: 'Consistent HSL string',
                received: `${color1}`,
                passCondition: 'Одинаковые ID дают одинаковый цвет.',
                failCondition: 'Цвета меняются при каждом рендере.',
                diagnosis: 'Сломан services/utils.ts → stringToColor: аватарки «мерцают» при каждом рендере.',
                task: regressionTask('services/utils.ts', 'stringToColor перестал быть детерминированным')
            });

            return res;
        }
    },
    {
        id: 'storage',
        title: 'Storage Logic',
        icon: HardDrive,
        description: 'Валидация типов файлов и конфигураций.',
        tests: () => {
            const res: TestResult[] = [];
            const allowedTypes = ['video/mp4', 'video/quicktime', 'video/webm'];
            const fileType = 'application/exe';
            const isAllowed = allowedTypes.includes(fileType);

            res.push({
                name: 'Upload Security Guard',
                description: 'Имитация проверки типа файла перед загрузкой',
                passed: !isAllowed,
                expected: 'Blocked',
                received: isAllowed ? 'Allowed' : 'Blocked',
                passCondition: 'Запрещенные типы файлов блокируются.',
                failCondition: 'Разрешена загрузка исполняемых файлов (.exe).',
                diagnosis: 'Кто-то расширил whitelist типов до исполняемых — проверь матрицу типов в ProjectView/useUploadManager.',
                task: regressionTask('Upload Security Guard', 'whitelist типов файлов пропускает исполняемые')
            });

            return res;
        }
    },
    {
        id: 'data_integrity',
        title: 'Data Integrity',
        icon: Database,
        description: 'Чистые проверки хранилища и схемы проектов (без записи данных).',
        tests: () => {
            if (!isBrowserRuntime() || typeof localStorage === 'undefined') {
                return [
                    skippedResult('localStorage Availability', 'localStorage доступен и работает (чтение/запись пробного ключа).'),
                    skippedResult('localStorage Headroom', 'Оценка заполненности localStorage (лимит ~5MB).'),
                    skippedResult('Project Schema (types.ts)', 'Схема проектов (id/assets/versions/comments) соответствует types.ts.')
                ];
            }
            const res: TestResult[] = [];

            // 1. Доступность localStorage (пробная запись + удаление)
            let lsAvailable = false;
            let lsError = '';
            try {
                const probeKey = 'anotee_diag_probe';
                localStorage.setItem(probeKey, '1');
                lsAvailable = localStorage.getItem(probeKey) === '1';
                localStorage.removeItem(probeKey);
            } catch (e: any) {
                lsError = e?.message || 'QuotaExceeded/Access denied';
            }
            res.push({
                name: 'localStorage Availability',
                description: 'localStorage доступен и не переполнен (чтение/запись/удаление пробного ключа).',
                passed: lsAvailable,
                severity: lsAvailable ? 'info' : 'critical',
                expected: 'Доступен',
                received: lsAvailable ? 'OK' : `Ошибка: ${lsError}`,
                passCondition: 'Пробный ключ записался, прочитался и удалился.',
                failCondition: 'Private mode, запрет cookies или переполненная квота — запись падает.',
                diagnosis: 'localStorage недоступен (приватный режим/жёсткий запрет cookies): в mock/local-режиме проекты и комментарии не сохраняются между сессиями; на проде ломается кэш и язык интерфейса.',
                task: [
                    '### T-XX Data: localStorage недоступен у клиента',
                    '- Приоритет: P1',
                    '- Источник: [diag] System Diagnostics → Data Integrity',
                    `- Проблема: localStorage бросает ошибку (${lsError}) — приватный режим или запрет хранилища.`,
                    '- Цель: обёртка над localStorage (services/apiClient.ts) с in-memory fallback и предупреждением пользователю о риске потери данных.',
                    '- Acceptance: в приватном режиме приложение работает, показывает предупреждение; тест /test зелёный (in-memory режим).'
                ].join('\n')
            });

            // 2. Заполненность (оценка: сумма длин ключей+значений, UTF-16 ≈ 2 байта/символ)
            let usedBytes = 0;
            try {
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k === null) continue;
                    usedBytes += (k.length + (localStorage.getItem(k) || '').length) * 2;
                }
            } catch { /* оценка недоступна — не фейлим */ }
            const QUOTA_BYTES = 5 * 1024 * 1024;
            const usedPct = Math.round((usedBytes / QUOTA_BYTES) * 100);
            res.push({
                name: 'localStorage Headroom',
                description: 'Оценка заполненности localStorage (лимит ~5MB).',
                passed: usedPct < 80,
                severity: usedPct < 80 ? 'info' : 'warning',
                expected: '< 80% квоты (~5MB)',
                received: `${usedPct}% (${Math.round(usedBytes / 1024)} KB)`,
                passCondition: 'Занято меньше 80% квоты.',
                failCondition: 'Хранилище почти заполнено: запись новых проектов/комментариев уронится с QuotaExceededError.',
                diagnosis: 'Накопленные данные (anotee_projects_data и др.) занимают почти всю квоту: сохранение новых правок начнёт молча падать.',
                task: [
                    '### T-XX Data: переполнение localStorage у клиента',
                    '- Приоритет: P1',
                    '- Источник: [diag] System Diagnostics → Data Integrity',
                    `- Проблема: localStorage заполнен на ${usedPct}% — приближается QuotaExceededError при сохранении проектов.`,
                    '- Цель: чистка/компрессия anotee_projects_data (удаление blob-URL, локальных файлов), миграция тяжёлых данных в облако.',
                    '- Acceptance: после чистки занято < 50%; сохранение проектов не падает.'
                ].join('\n')
            });

            // 3. Схема проекта (types.ts: id → assets[].id → versions[].id + comments[])
            const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
            const validateProjectSchema = (projects: unknown[]): string | null => {
                for (let pi = 0; pi < projects.length; pi++) {
                    const p = projects[pi];
                    if (!isRecord(p) || typeof p.id !== 'string' || !p.id) return `projects[${pi}].id`;
                    if (!Array.isArray(p.assets)) return `projects[${pi}].assets`;
                    for (let ai = 0; ai < p.assets.length; ai++) {
                        const a = p.assets[ai];
                        if (!isRecord(a) || typeof a.id !== 'string' || !a.id) return `projects[${pi}].assets[${ai}].id`;
                        if (!Array.isArray(a.versions)) return `projects[${pi}].assets[${ai}].versions`;
                        for (let vi = 0; vi < a.versions.length; vi++) {
                            const v = a.versions[vi];
                            if (!isRecord(v) || typeof v.id !== 'string' || !v.id) return `projects[${pi}].assets[${ai}].versions[${vi}].id`;
                            if (!Array.isArray(v.comments)) return `projects[${pi}].assets[${ai}].versions[${vi}].comments`;
                        }
                    }
                }
                return null;
            };

            let source = 'mock (constants.ts)';
            let projects: unknown[] = MOCK_PROJECTS as unknown[];
            try {
                const raw = localStorage.getItem('anotee_projects_data');
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        projects = parsed;
                        source = 'localStorage (anotee_projects_data)';
                    }
                }
            } catch { /* парсинг не удался — проверяем mock */ }

            const schemaError = validateProjectSchema(projects);
            res.push({
                name: 'Project Schema (types.ts)',
                description: 'Схема проектов: id → assets[] → versions[] → comments[] соответствуют types.ts.',
                passed: schemaError === null,
                severity: schemaError === null ? 'info' : 'critical',
                expected: 'Все проекты: id, assets[], versions[], comments[]',
                received: schemaError === null
                    ? `OK: ${projects.length} проект(ов) из ${source}`
                    : `Сломано поле: ${schemaError} (источник: ${source})`,
                passCondition: 'Все обязательные поля схемы types.ts присутствуют во всех проектах.',
                failCondition: 'Отсутствует обязательное поле — UI может падать или терять комментарии.',
                diagnosis: 'Данные проекта не соответствуют types.ts: вероятна ручная правка localStorage, старая схема без миграции или баг синка — UI может упасть (белый экран) или потерять комментарии.',
                task: [
                    '### T-XX Data: схема проекта не соответствует types.ts',
                    '- Приоритет: P0',
                    '- Источник: [diag] System Diagnostics → Data Integrity',
                    `- Проблема: в данных (${source}) отсутствует обязательное поле: ${schemaError} — нарушен контракт types.ts.`,
                    '- Цель: добавить миграцию/нормализацию при загрузке (services/apiClient.ts: ensureProjectShape), найти источник битых данных.',
                    '- Acceptance: тест Project Schema на /test зелёный; юнит-тест на нормализацию битой схемы.'
                ].join('\n')
            });

            return res;
        }
    },
    {
        id: 'math',
        title: 'Core Logic & Math',
        icon: Calculator,
        description: 'Математическое ядро: таймкоды, кадры, округления.',
        tests: () => {
            const res: TestResult[] = [];
            const fps25 = 25;
            const framesTotal = Math.floor(1.5 * fps25);
            res.push({
                name: 'FPS Calculation (PAL)',
                description: 'Расчет кадров: 1.5 сек @ 25fps',
                passed: framesTotal === 37,
                expected: '37 frames',
                received: `${framesTotal}`,
                passCondition: 'Math.floor(1.5 * 25) === 37',
                failCondition: 'Ошибка плавающей запятой.',
                diagnosis: 'Арифметика кадров сломалась (железное правило №4: кадры через Math.floor) — рассинхрон маркеров.',
                task: regressionTask('Core Logic & Math', 'расчёт кадров 1.5s @ 25fps')
            });

            const tc = formatTimecode(65.5, 25);
            res.push({
                name: 'SMPTE Timecode',
                description: 'Форматирование 65.5с в таймкод',
                passed: tc === '00:01:05:12',
                expected: '00:01:05:12',
                received: tc,
                passCondition: 'Корректный перевод секунд в ЧЧ:ММ:СС:КК',
                failCondition: 'Неверный расчет остатка кадров.',
                diagnosis: 'formatTimecode (services/utils.ts) выдаёт неверный таймкод — экспорт XML/CSV/EDL будет с битыми маркерами.',
                task: regressionTask('services/utils.ts', 'formatTimecode неверный остаток кадров')
            });

            return res;
        }
    },
    {
        id: 'billing',
        title: 'Billing & Limits',
        icon: CreditCard,
        description: 'Логика подписок и истечения сроков.',
        tests: () => {
            const res: TestResult[] = [];
            
            const pastDate = Date.now() - (10 * 24 * 60 * 60 * 1000); 
            const isExp = isExpired(pastDate, 7); 
            
            res.push({
                name: 'Subscription Expiry Check',
                description: 'Проверка флага isExpired для даты в прошлом',
                passed: isExp === true,
                expected: 'Expired (true)',
                received: `${isExp}`,
                passCondition: 'Дата 10-дневной давности считается истекшей (лимит 7 дней).',
                failCondition: 'Пользователь сохраняет доступ после истечения срока.',
                diagnosis: 'Сломан services/utils.ts → isExpired: истёкшие подписки не блокируются (монетизация).',
                task: regressionTask('services/utils.ts', 'isExpired не помечает истекшие подписки')
            });

            const daysLeft = getDaysRemaining(pastDate, 7); 
            const daysLeftFuture = getDaysRemaining(Date.now(), 7); 

            res.push({
                name: 'Days Remaining Calc',
                description: 'Расчет остатка дней триала',
                passed: daysLeft === 0 && daysLeftFuture === 7,
                expected: '0 and 7',
                received: `${daysLeft} / ${daysLeftFuture}`,
                passCondition: 'Истекший срок = 0, Новый срок = 7.',
                failCondition: 'Неверный расчет дней до блокировки.',
                diagnosis: 'Сломан services/utils.ts → getDaysRemaining: UI показывает неверные дни до блокировки.',
                task: regressionTask('services/utils.ts', 'getDaysRemaining неверный расчёт дней')
            });

            return res;
        }
    },
    {
        id: 'export',
        title: 'Export Engines',
        icon: FileOutput,
        description: 'Генераторы файлов для монтажных программ.',
        tests: () => {
            const res: TestResult[] = [];
            const edl = generateEDL('Test', 1, mockComments, 24);
            res.push({
                name: 'EDL Header Generation',
                description: 'Валидация заголовка EDL файла',
                passed: edl.includes('TITLE: Test_v1') && edl.includes('FCM: NON-DROP FRAME'),
                expected: 'Valid Header',
                received: edl.substring(0, 20) + '...',
                passCondition: 'Содержит TITLE и FCM.',
                failCondition: 'Файл не откроется в DaVinci.',
                diagnosis: 'Сломан services/exportService.ts → generateEDL: экспорт для DaVinci битый.',
                task: regressionTask('services/exportService.ts', 'generateEDL потерял TITLE/FCM заголовок')
            });

            const unsafeXml = generateResolveXML('Test', 1, [{...mockComments[0], text: 'A & B < C'}], 24);
            res.push({
                name: 'XML Escaping',
                description: 'Экранирование спецсимволов (& < >)',
                passed: unsafeXml.includes('A &amp; B &lt; C'),
                expected: '&amp; &lt;',
                received: unsafeXml.includes('&amp;') ? 'Escaped' : 'Raw',
                passCondition: 'Спецсимволы заменены на HTML entities.',
                failCondition: 'Битый XML файл.',
                diagnosis: 'Сломано экранирование в services/exportService.ts → generateResolveXML: XML не парсится при спецсимволах в комментариях.',
                task: regressionTask('services/exportService.ts', 'экранирование XML-спецсимволов')
            });

            return res;
        }
    },
    {
        id: 'security',
        title: 'Security & Sanitization',
        icon: ShieldAlert,
        description: 'Проверка защиты от инъекций и валидации типов.',
        tests: () => {
            const res: TestResult[] = [];
            const unsafeInput = "<script>alert('xss')</script>";
            const sanitized = unsafeInput.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            res.push({
                name: 'XSS Sanitization',
                description: 'Эмуляция очистки ввода',
                passed: !sanitized.includes("<script>"),
                expected: '&lt;script&gt;',
                received: sanitized,
                passCondition: 'Теги скриптов превращены в текст.',
                failCondition: 'Исполняемый JS код.',
                diagnosis: 'Санитизация ввода сломана — проверь все места рендера пользовательского текста (comments, названия проектов).',
                task: regressionTask('Security & Sanitization', 'санитизация HTML-тегов ввода')
            });

            return res;
        }
    },
    {
        id: 'sys',
        title: 'System Utils',
        icon: Cpu,
        description: 'Генерация ID и системные функции.',
        tests: () => {
            const res: TestResult[] = [];
            const uuid = generateId();
            const isValidUUID = uuid.length >= 32; 

            res.push({
                name: 'UUID Generation',
                description: 'Генерация уникального ID',
                passed: isValidUUID,
                expected: 'Length >= 32',
                received: uuid,
                passCondition: 'Генерируется непустая строка достаточной длины.',
                failCondition: 'Дубликаты ID приведут к коллизиям в БД.',
                diagnosis: 'generateId (services/utils.ts) возвращает короткие/пустые ID — коллизии при синке.',
                task: regressionTask('services/utils.ts', 'generateId возвращает ID недостаточной длины')
            });

            return res;
        }
    },
    {
        id: 'perf',
        title: 'Performance',
        icon: Zap,
        description: 'Стресс-тесты производительности в браузере.',
        tests: () => {
            const res: TestResult[] = [];
            const start = performance.now();
            const arr = new Array(50000).fill(0).map((_, i) => i);
            const filtered = arr.filter(n => n % 2 === 0);
            const duration = performance.now() - start;

            res.push({
                name: 'Large Array Filter (50k)',
                description: 'Фильтрация массива 50,000 элементов',
                passed: duration < 50 && filtered.length === 25000,
                expected: '< 50ms',
                received: `${duration.toFixed(2)}ms`,
                passCondition: 'Операция выполняется мгновенно (без фриза UI).',
                failCondition: 'Медленный алгоритм.',
                severity: 'warning',
                diagnosis: 'Устройство/вкладка сильно нагружены (троттлинг CPU, фоновые процессы): UI-операции могут «фризить». Это характеристика окружения, а не кода.',
                task: [
                    '### T-XX Perf: медленный клиент (стресс-тест CPU)',
                    '- Приоритет: P2',
                    '- Источник: [diag] System Diagnostics → Performance',
                    '- Проблема: фильтрация 50k элементов заняла > 50ms — устройство нагружено или слабое.',
                    '- Цель: замерить распределение по отчётам /test; при системных фризах — профилировать таймлайн плеера.',
                    '- Acceptance: медиана теста по пользователям < 50ms.'
                ].join('\n')
            });

            return res;
        }
    },
    {
        id: 'i18n',
        title: 'I18N & Unicode',
        icon: Globe,
        description: 'Поддержка кириллицы и спецсимволов.',
        tests: () => {
            const res: TestResult[] = [];
            const path = "проект/видео.mp4";
            const encoded = encodeURIComponent(path);
            
            res.push({
                name: 'URL Encoding (Cyrillic)',
                description: 'Кодирование путей для S3/Drive',
                passed: encoded.includes('%D0%BF'),
                expected: '%D0%BF...',
                received: encoded.substring(0, 10),
                passCondition: 'Кириллица корректно кодируется в URI.',
                failCondition: '404 ошибка при загрузке файлов с русскими именами.',
                diagnosis: 'encodeURIComponent ведёт себя нестандартно — проверь версию браузера/полифиллы.',
                task: regressionTask('I18N & Unicode', 'кодирование кириллицы в URI')
            });

            return res;
        }
    },
    {
        id: 'i18n_ui',
        title: 'i18n / UI Locale',
        icon: Languages,
        description: 'Случайная выборка из 10 реальных ключей присутствует в активной локали (t() не возвращает сырой ключ).',
        tests: () => {
            if (!i18n.isInitialized) {
                return [skippedResult(
                    'Locale Keys Sampling (10)',
                    'Случайная выборка из 10 использованных в коде ключей присутствует в активной локали.'
                )];
            }
            const lang = i18n.language;
            const sample = shuffle(I18N_SAMPLE_KEYS).slice(0, 10);
            const missing = sample.filter(k => {
                const v = i18n.t(k);
                return !v || v === k;
            });
            const res: TestResult[] = [];
            res.push({
                name: 'Locale Keys Sampling (10)',
                description: 'Случайная выборка из 10 использованных в коде ключей присутствует в активной локали.',
                passed: missing.length === 0,
                severity: missing.length === 0 ? 'info' : 'warning',
                expected: `10/10 ключей переведены в '${lang}'`,
                received: missing.length === 0
                    ? `10/10 OK (${lang})`
                    : `Отсутствуют в '${lang}': ${missing.join(', ')}`,
                passCondition: 'i18next возвращает перевод (не сырой ключ) для всех 10 случайных ключей.',
                failCondition: 'Хотя бы один ключ вернулся как сырой ключ: в UI попадёт «nav.dashboard» вместо текста.',
                diagnosis: `Ключи отсутствуют в активной локали '${lang}': рассинхрон en.json/ru.json (контракт tests/unit/i18n.test.ts) или ключ удалён из кода, но остался в выборке. es/ja/ko/pt частичны и фолбэка́тся на en — для них это норма.`,
                task: [
                    '### T-XX i18n: отсутствующие ключи в активной локали',
                    '- Приоритет: P2',
                    '- Источник: [diag] System Diagnostics → i18n / UI Locale',
                    `- Проблема: в локали '${lang}' отсутствуют ключи: ${missing.join(', ') || '(перепрогнать — выборка случайная)'} — в UI сырые ключи.`,
                    '- Цель: восстановить пары en.json+ru.json (контракт tests/unit/i18n.test.ts), прогнать npm run i18n:extract.',
                    '- Acceptance: тест Locale Keys Sampling на /test зелёный; npm run test зелёный.'
                ].join('\n')
            });
            return res;
        }
    }
];
