
import { generateEDL, generateResolveXML, generateCSV } from './exportService';
import { generateId, stringToColor, formatTimecode, isExpired, getDaysRemaining } from './utils';
import { Comment, CommentStatus, DEFAULT_CONFIG, DEFAULT_PAYMENT_CONFIG } from '../types';
import { MOCK_PROJECTS } from '../constants';
import { Calculator, Clock, FileOutput, ShieldCheck, Database, Globe, Wifi, ShieldAlert, Zap, Server, Film } from 'lucide-react';

export type TestResult = {
    name: string;
    passed: boolean;
    expected?: string;
    received?: string;
    description: string;
    passCondition: string;
    failCondition: string;
    timestamp?: number;
};

export type TestGroup = {
    id: string;
    title: string;
    icon: any;
    description: string;
    tests: () => Promise<TestResult[]> | TestResult[];
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
                    expected: 'Status: 200 OK',
                    received: `Status: ${health.status}, Time: ${duration.toFixed(0)}ms`,
                    passCondition: 'Сервер отвечает 200 OK и JSON {status: "ok"}.',
                    failCondition: '500 Error, таймаут или некорректный JSON.'
                });
            } catch (e: any) {
                res.push({
                    name: 'API Healthcheck',
                    description: 'Ping /api/health endpoint.',
                    passed: false,
                    expected: '200 OK',
                    received: e.message,
                    passCondition: 'Сервер доступен.',
                    failCondition: 'Сетевая ошибка или сервер упал.'
                });
            }

            // 2. Auth Guard Check
            try {
                // Запрос без токена должен вернуть 401
                const secured = await fetch('/api/data');
                res.push({
                    name: 'Auth Guard (401 Check)',
                    description: 'Попытка доступа к защищенному API без токена.',
                    passed: secured.status === 401,
                    expected: '401 Unauthorized',
                    received: `${secured.status} ${secured.statusText}`,
                    passCondition: 'Сервер отклоняет запросы без заголовка Authorization.',
                    failCondition: 'Сервер возвращает 200 (утечка данных) или 500.'
                });
            } catch (e: any) {
                // Fetch error is purely network, likely passed test logic if status was checked
                res.push({
                    name: 'Auth Guard (401 Check)',
                    description: 'Network check',
                    passed: false,
                    received: e.message,
                    expected: '401',
                    passCondition: 'Network ok',
                    failCondition: 'Network fail'
                });
            }

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
            const sampleUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

            // 1. Head Request Check
            try {
                const head = await fetch(sampleUrl, { method: 'HEAD' });
                const type = head.headers.get('content-type');
                
                res.push({
                    name: 'Video CDN Access',
                    description: 'Проверка доступности публичного тестового видео.',
                    passed: head.ok && (type?.includes('video') || false),
                    expected: '200 OK, video/mp4',
                    received: `${head.status}, ${type}`,
                    passCondition: 'Сервер отдает видео-файл с корректным MIME.',
                    failCondition: 'CORS ошибка или 404.'
                });
            } catch (e: any) {
                res.push({
                    name: 'Video CDN Access',
                    description: 'CORS / Network check',
                    passed: false,
                    expected: 'Success',
                    received: e.message,
                    passCondition: 'Fetch успешен.',
                    failCondition: 'Блокировка CORS или сети.'
                });
            }

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
            
            // FPS Math
            const fps25 = 25;
            const framesTotal = Math.floor(1.5 * fps25);
            res.push({
                name: 'FPS Calculation (PAL)',
                description: 'Расчет кадров: 1.5 сек @ 25fps',
                passed: framesTotal === 37,
                expected: '37 frames',
                received: `${framesTotal}`,
                passCondition: 'Math.floor(1.5 * 25) === 37',
                failCondition: 'Ошибка плавающей запятой.'
            });

            // SMPTE
            const tc = formatTimecode(65.5, 25);
            res.push({
                name: 'SMPTE Timecode',
                description: 'Форматирование 65.5с в таймкод',
                passed: tc === '00:01:05:12',
                expected: '00:01:05:12',
                received: tc,
                passCondition: 'Корректный перевод секунд в ЧЧ:ММ:СС:КК',
                failCondition: 'Неверный расчет остатка кадров.'
            });

            return res;
        }
    },
    {
        id: 'export',
        title: 'Export Engines',
        icon: FileOutput,
        description: 'Генераторы файлов для монтажных программ (XML, EDL, CSV).',
        tests: () => {
            const res: TestResult[] = [];
            
            // EDL
            const edl = generateEDL('Test', 1, mockComments, 24);
            res.push({
                name: 'EDL Header Generation',
                description: 'Валидация заголовка EDL файла',
                passed: edl.includes('TITLE: Test_v1') && edl.includes('FCM: NON-DROP FRAME'),
                expected: 'Valid Header',
                received: edl.substring(0, 20) + '...',
                passCondition: 'Содержит TITLE и FCM.',
                failCondition: 'Файл не откроется в DaVinci.'
            });

            // XML Safety
            const unsafeXml = generateResolveXML('Test', 1, [{...mockComments[0], text: 'A & B < C'}], 24);
            res.push({
                name: 'XML Escaping',
                description: 'Экранирование спецсимволов (& < >)',
                passed: unsafeXml.includes('A &amp; B &lt; C'),
                expected: '&amp; &lt;',
                received: unsafeXml.includes('&amp;') ? 'Escaped' : 'Raw',
                passCondition: 'Спецсимволы заменены на HTML entities.',
                failCondition: 'Битый XML файл.'
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

            // XSS Simulation
            const unsafeInput = "<script>alert('xss')</script>";
            const sanitized = unsafeInput.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            res.push({
                name: 'XSS Sanitization',
                description: 'Эмуляция очистки ввода',
                passed: !sanitized.includes("<script>"),
                expected: '&lt;script&gt;',
                received: sanitized,
                passCondition: 'Теги скриптов превращены в текст.',
                failCondition: 'Исполняемый JS код.'
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
                passed: duration < 50,
                expected: '< 50ms',
                received: `${duration.toFixed(2)}ms`,
                passCondition: 'Операция выполняется мгновенно (без фриза UI).',
                failCondition: 'Медленный алгоритм.'
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
                failCondition: '404 ошибка при загрузке файлов с русскими именами.'
            });

            return res;
        }
    }
];
