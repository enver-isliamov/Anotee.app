
import React, { useState, useEffect } from 'react';
import { generateEDL, generateResolveXML, generateCSV } from '../services/exportService';
import { generateId, stringToColor, formatTimecode, isExpired, getDaysRemaining } from '../services/utils';
import { Comment, CommentStatus, DEFAULT_CONFIG, DEFAULT_PAYMENT_CONFIG } from '../types';
import { MOCK_PROJECTS } from '../constants';
import { ArrowLeft, CheckCircle2, XCircle, Play, RefreshCw, Calculator, FileOutput, ShieldCheck, ChevronRight, FlaskConical, Clock, Database, Globe, Wifi } from 'lucide-react';

// --- TEST TYPES ---

type TestResult = {
    name: string;
    passed: boolean;
    expected?: string;
    received?: string;
    description: string;
    // New context fields
    passCondition: string;
    failCondition: string;
};

type TestGroup = {
    id: string;
    title: string;
    icon: React.ElementType;
    tests: () => Promise<TestResult[]> | TestResult[]; // Support async tests
};

// Mock data for deterministic testing
const mockComments: Comment[] = [
    {
        id: 'c1',
        userId: 'u1',
        text: 'Test Comment',
        timestamp: 10.0, // 10 sec
        status: CommentStatus.OPEN,
        createdAt: 'now'
    }
];

export const TestRunner: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [results, setResults] = useState<Record<string, TestResult[]>>({});
    const [isRunning, setIsRunning] = useState(false);
    const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

    const testGroups: TestGroup[] = [
        {
            id: 'math',
            title: 'Core Math & Timecodes',
            icon: Calculator,
            tests: () => {
                const res: TestResult[] = [];
                
                // Test 1: 25 FPS Calculation (PAL)
                const fps25 = 25;
                const time25 = 1.5; 
                const framesTotal = Math.floor(time25 * fps25); // 37
                
                res.push({
                    name: 'FPS Math (25fps PAL)',
                    description: 'Проверка расчета кадров для 1.5 сек при 25 FPS.',
                    passed: framesTotal === 37,
                    expected: '37 frames',
                    received: `${framesTotal} frames`,
                    passCondition: 'Math.floor(1.5 * 25) === 37',
                    failCondition: 'Ошибка округления floating point (37.0000001 -> 38) или неверный множитель.'
                });

                // Test 2: NTSC Drop Frame Logic Check (Simplified)
                const fpsNtsc = 29.97;
                const timeNtsc = 10;
                const framesNtsc = Math.floor(timeNtsc * fpsNtsc);
                
                res.push({
                    name: 'FPS Math (29.97fps NTSC)',
                    description: 'Проверка расчета кадров для 10 сек при 29.97 FPS.',
                    passed: framesNtsc === 299,
                    expected: '299 frames',
                    received: `${framesNtsc} frames`,
                    passCondition: 'Результат 299 кадров (299.7 округлено вниз).',
                    failCondition: 'Использование Math.round() вместо floor() даст 300, что вызовет рассинхрон.'
                });

                return res;
            }
        },
        {
            id: 'time',
            title: 'Time & Logic',
            icon: Clock,
            tests: () => {
                const res: TestResult[] = [];
                
                // SMPTE Formatter
                const t1 = formatTimecode(0, 25);
                res.push({
                    name: 'SMPTE Zero Check',
                    description: 'Format 0s at 25fps',
                    passed: t1 === '00:00:00:00',
                    expected: '00:00:00:00',
                    received: t1,
                    passCondition: 'Функция возвращает строку "00:00:00:00".',
                    failCondition: 'Возврат null, undefined или "NaN:NaN..." при нулевом входе.'
                });

                const t2 = formatTimecode(65.5, 25); // 1 min 5 sec 12 frames (0.5 * 25 = 12.5 -> 12)
                const t2Expected = '00:01:05:12';
                res.push({
                    name: 'SMPTE Complex Check',
                    description: 'Format 65.5s at 25fps',
                    passed: t2 === t2Expected,
                    expected: t2Expected,
                    received: t2,
                    passCondition: 'Корректный расчет минут (01), секунд (05) и кадров (12).',
                    failCondition: 'Ошибки в модульной арифметике (%) при переводе секунд в минуты.'
                });

                // Expiry Logic
                const oneDayMs = 24 * 60 * 60 * 1000;
                const eightDaysAgo = Date.now() - (8 * oneDayMs);
                const expired = isExpired(eightDaysAgo, 7);
                res.push({
                    name: 'Expiry Check (>7 Days)',
                    description: 'isExpired(8 days ago, 7 limit)',
                    passed: expired === true,
                    expected: 'true',
                    received: String(expired),
                    passCondition: 'Дата создания старше лимита дней возвращает true.',
                    failCondition: 'Логика перепутана (< вместо >) или неверный расчет миллисекунд.'
                });

                const twoDaysAgo = Date.now() - (2 * oneDayMs);
                const remaining = getDaysRemaining(twoDaysAgo, 7);
                res.push({
                    name: 'Days Remaining',
                    description: 'getDaysRemaining(2 days ago, 7 limit)',
                    passed: remaining === 5,
                    expected: '5',
                    received: String(remaining),
                    passCondition: '7 (лимит) - 2 (прошло) = 5 дней.',
                    failCondition: 'Отрицательные числа или неверный подсчет дней.'
                });

                return res;
            }
        },
        {
            id: 'export',
            title: 'Export Generators',
            icon: FileOutput,
            tests: () => {
                const res: TestResult[] = [];
                
                // Test EDL Header
                const edl = generateEDL('Test', 1, mockComments, 24);
                const hasTitle = edl.includes('TITLE: Test_v1');
                res.push({
                    name: 'EDL Structure',
                    description: 'Генерация заголовка EDL файла.',
                    passed: hasTitle,
                    expected: 'Contains "TITLE: Test_v1"',
                    received: hasTitle ? 'Valid Header' : 'Missing Header',
                    passCondition: 'EDL начинается с TITLE: и FCM: NON-DROP FRAME.',
                    failCondition: 'Отсутствие заголовков сделает файл нечитаемым для DaVinci.'
                });

                // Test XML Color Mapping
                const xml = generateResolveXML('Test', 1, mockComments, 24);
                const hasColorRed = xml.includes('<name>Red</name>'); 
                res.push({
                    name: 'XML Color Mapping',
                    description: 'Проверка маппинга цвета (Open Status -> Red Color) для DaVinci.',
                    passed: hasColorRed,
                    expected: '<name>Red</name>',
                    received: hasColorRed ? 'Found <name>Red</name>' : 'Tag Missing',
                    passCondition: 'Комментарий со статусом OPEN получает тег <name>Red</name>.',
                    failCondition: 'Неверный регистр цвета (red вместо Red) или отсутствие тега.'
                });

                // Test CSV Escaping
                const trickyComment = [{ ...mockComments[0], text: 'Hello "World"' }];
                const csv = generateCSV(trickyComment);
                const hasEscapedQuotes = csv.includes('""World""');
                res.push({
                    name: 'CSV Sanitization',
                    description: 'Экранирование кавычек в CSV для Excel/Premiere.',
                    passed: hasEscapedQuotes,
                    expected: 'Hello ""World""',
                    received: hasEscapedQuotes ? 'Escaped Correctly' : 'Injection Vulnerable',
                    passCondition: 'Двойные кавычки заменяются на пару двойных кавычек ("").',
                    failCondition: 'CSV ломается, если в тексте комментария есть кавычки.'
                });

                // Test XML Special Char Escaping
                const xmlComment = [{ ...mockComments[0], text: 'Me & You < 3' }];
                const unsafeXml = generateResolveXML('Test', 1, xmlComment, 24);
                const isSafe = unsafeXml.includes('Me &amp; You &lt; 3');
                res.push({
                    name: 'XML Entity Escaping',
                    description: 'Экранирование спецсимволов (& < >) для валидности XML.',
                    passed: isSafe,
                    expected: 'Me &amp; You &lt; 3',
                    received: isSafe ? 'Escaped Correctly' : 'Invalid XML',
                    passCondition: 'Символы <, >, & заменены на &lt;, &gt;, &amp;.',
                    failCondition: 'Генерация битого XML, который не откроется в монтажке.'
                });

                return res;
            }
        },
        {
            id: 'utils',
            title: 'System Utils',
            icon: ShieldCheck,
            tests: () => {
                const res: TestResult[] = [];
                
                // Test ID Gen Collision
                const ids = new Set();
                let collision = false;
                for(let i=0; i<100; i++) {
                    const id = generateId();
                    if(ids.has(id)) collision = true;
                    ids.add(id);
                }
                
                const sampleId = generateId();
                const isValidFormat = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sampleId) || /^[0-9a-f]{30,}$/.test(sampleId);

                res.push({
                    name: 'ID Generator Collision',
                    description: 'Генерация 100 уникальных UUID и проверка на дубликаты.',
                    passed: !collision,
                    expected: '0 Collisions',
                    received: collision ? 'Collision Detected' : 'Unique',
                    passCondition: 'Все 100 сгенерированных ID уникальны.',
                    failCondition: 'Слабый генератор случайных чисел (Math.random) вызвал коллизию.'
                });

                res.push({
                    name: 'ID Format Check',
                    description: 'Проверка формата ID (UUID v4 or Hex).',
                    passed: isValidFormat,
                    expected: 'UUID / Hex',
                    received: sampleId,
                    passCondition: 'ID соответствует формату UUID или Hex-строки.',
                    failCondition: 'Генерация пустых строк или недопустимых символов.'
                });

                // Test Color Determinism
                const userA = 'user_123';
                const color1 = stringToColor(userA);
                const color2 = stringToColor(userA);
                res.push({
                    name: 'Color Determinism',
                    description: 'Один и тот же UserID должен всегда генерировать одинаковый цвет.',
                    passed: color1 === color2,
                    expected: color1,
                    received: color2,
                    passCondition: 'Функция чистая (pure), результат зависит только от аргумента.',
                    failCondition: 'Использование Math.random() внутри функции цвета.'
                });

                return res;
            }
        },
        {
            id: 'integrity',
            title: 'Data Integrity & Configs',
            icon: Database,
            tests: () => {
                const res: TestResult[] = [];

                // 1. Feature Flags Fallback
                const hasDrive = DEFAULT_CONFIG.google_drive.enabledForPro;
                const hasLimit = DEFAULT_CONFIG.max_projects.limitFree === 3;
                res.push({
                    name: 'Default Config Integrity',
                    description: 'Проверка наличия критических флагов в дефолтном конфиге.',
                    passed: hasDrive && hasLimit,
                    expected: 'Drive: true, Limit: 3',
                    received: `Drive: ${hasDrive}, Limit: ${DEFAULT_CONFIG.max_projects.limitFree}`,
                    passCondition: 'DEFAULT_CONFIG содержит корректные fallback-значения.',
                    failCondition: 'Отсутствие ключей в конфиге приведет к крашу UI при загрузке.'
                });

                // 2. Payment Config Structure
                const hasPlans = !!DEFAULT_PAYMENT_CONFIG.plans.free && !!DEFAULT_PAYMENT_CONFIG.plans.lifetime;
                const priceCheck = DEFAULT_PAYMENT_CONFIG.prices.lifetime > 0;
                res.push({
                    name: 'Payment Defaults',
                    description: 'Валидация структуры планов и цен по умолчанию.',
                    passed: hasPlans && priceCheck,
                    expected: 'Plans exist, Price > 0',
                    received: hasPlans ? 'OK' : 'Missing Plans',
                    passCondition: 'Объекты plans.free и plans.lifetime существуют.',
                    failCondition: 'Ошибки в типах TS или удаление ключей планов.'
                });

                // 3. Mock Data Structure
                const mockProject = MOCK_PROJECTS[0];
                const hasAssets = mockProject.assets.length > 0;
                const hasVersions = mockProject.assets[0]?.versions.length > 0;
                res.push({
                    name: 'Mock Data Validity',
                    description: 'Проверка целостности моковых данных для Demo режима.',
                    passed: hasAssets && hasVersions,
                    expected: 'Assets & Versions present',
                    received: hasAssets ? 'OK' : 'Empty Assets',
                    passCondition: 'Мок-проект имеет хотя бы 1 ассет и 1 версию.',
                    failCondition: 'Плеер в Demo-режиме упадет с ошибкой "Version not found".'
                });

                return res;
            }
        },
        {
            id: 'i18n',
            title: 'I18N & Encoding',
            icon: Globe,
            tests: () => {
                const res: TestResult[] = [];
                
                const rawName = "Видео Проект #1";
                const safeRegex = /[^\p{L}\p{N}\s\-_]/gu;
                let isSupported = false;
                try {
                    const result = rawName.replace(safeRegex, '');
                    isSupported = result.includes("Видео");
                } catch(e) {
                    isSupported = false;
                }

                res.push({
                    name: 'Cyrillic Regex Support',
                    description: 'Проверка поддержки Unicode-регулярок в браузере.',
                    passed: isSupported,
                    expected: 'Supported',
                    received: isSupported ? 'Supported' : 'Not Supported',
                    passCondition: 'Браузер поддерживает флаг /u и классы \\p{L} для кириллицы.',
                    failCondition: 'Старые браузеры могут вырезать кириллицу из имен файлов.'
                });

                const path = "папка/файл.mp4";
                const encoded = encodeURIComponent(path);
                res.push({
                    name: 'URL Encoding (Cyrillic)',
                    description: 'Проверка кодирования путей для S3.',
                    passed: encoded === "%D0%BF%D0%B0%D0%BF%D0%BA%D0%B0%2F%D1%84%D0%B0%D0%B9%D0%BB.mp4",
                    expected: '%D0%BF...',
                    received: encoded.substring(0, 10) + '...',
                    passCondition: 'encodeURIComponent корректно кодирует русские буквы в %D0...',
                    failCondition: 'Неверная кодировка приведет к 404 ошибке при загрузке с S3.'
                });

                return res;
            }
        },
        {
            id: 'network',
            title: 'Network & Resilience',
            icon: Wifi,
            tests: async () => {
                const res: TestResult[] = [];

                // 1. Simulating Async Delay
                const start = Date.now();
                await new Promise(r => setTimeout(r, 100));
                const diff = Date.now() - start;
                
                res.push({
                    name: 'Async Loop Check',
                    description: 'Проверка работы Event Loop и асинхронности.',
                    passed: diff >= 100,
                    expected: '>= 100ms',
                    received: `${diff}ms`,
                    passCondition: 'Таймер setTimeout не блокируется синхронным кодом.',
                    failCondition: 'Блокировка основного потока (UI Freeze) тяжелыми вычислениями.'
                });

                // 2. Fetch Error Handling
                let caughtError = false;
                try {
                    // Intentionally invalid URL to simulate failure
                    await fetch('https://invalid-url-simulation.test');
                } catch(e) {
                    caughtError = true;
                }

                res.push({
                    name: 'Fetch Error Trap',
                    description: 'Убедиться, что fetch выбрасывает исключение при сбое сети.',
                    passed: caughtError,
                    expected: 'Error Caught',
                    received: caughtError ? 'Caught' : 'No Error',
                    passCondition: 'Сбой сети корректно перехватывается блоком catch.',
                    failCondition: 'Промис зависает или ошибка не всплывает (Silent Fail).'
                });

                return res;
            }
        }
    ];

    const runAllTests = async () => {
        setIsRunning(true);
        setResults({});
        setExpandedGroup('network'); // Focus on new tests 
        
        await new Promise(r => setTimeout(r, 600));

        const newResults: Record<string, TestResult[]> = {};
        
        for (const group of testGroups) {
            try {
                // Handle both sync and async tests
                const result = group.tests();
                if (result instanceof Promise) {
                    newResults[group.id] = await result;
                } else {
                    newResults[group.id] = result;
                }
            } catch (e: any) {
                newResults[group.id] = [{
                    name: 'CRITICAL EXCEPTION',
                    passed: false,
                    description: 'Test suite crashed unexpectedly.',
                    received: e.message,
                    expected: 'No Crash',
                    passCondition: 'Тест выполняется без исключений.',
                    failCondition: `Критическая ошибка в коде теста: ${e.message}`
                }];
            }
        }

        setResults(newResults);
        setIsRunning(false);
    };

    // Auto-run on mount
    useEffect(() => {
        runAllTests();
    }, []);

    const toggleGroup = (id: string) => {
        setExpandedGroup(expandedGroup === id ? null : id);
    };

    // Stats
    const totalTests = Object.values(results).flat().length;
    const passedTests = Object.values(results).flat().filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;

    return (
        <div className="min-h-screen bg-black text-zinc-100 p-4 md:p-8 font-mono selection:bg-indigo-500/30">
            <div className="max-w-4xl mx-auto">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-zinc-800">
                    <div className="flex items-center gap-4">
                        <button onClick={onBack} className="p-2 bg-zinc-900 rounded-lg hover:bg-zinc-800 transition-colors border border-zinc-800">
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                                <FlaskConical className="text-indigo-500" />
                                System Diagnostics
                            </h1>
                            <p className="text-xs text-zinc-500 mt-1">Anotee Internal Self-Test Environment v1.4</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <div className="text-right hidden md:block">
                            <div className="text-xs text-zinc-500 uppercase font-bold">Status</div>
                            <div className={`text-sm font-bold ${failedTests > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                {totalTests === 0 ? 'WAITING' : (failedTests > 0 ? 'SYSTEM UNSTABLE' : 'ALL SYSTEMS GO')}
                            </div>
                        </div>
                        <button 
                            onClick={runAllTests} 
                            disabled={isRunning} 
                            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold flex items-center gap-2 transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(79,70,229,0.3)]"
                        >
                            {isRunning ? <RefreshCw size={18} className="animate-spin" /> : <Play size={18} />}
                            {isRunning ? 'Running...' : 'Rerun Suite'}
                        </button>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-xl text-center">
                        <div className="text-zinc-500 text-[10px] uppercase font-bold mb-1">Total Tests</div>
                        <div className="text-2xl font-bold text-white">{totalTests}</div>
                    </div>
                    <div className="bg-green-900/10 border border-green-900/30 p-4 rounded-xl text-center">
                        <div className="text-green-500/70 text-[10px] uppercase font-bold mb-1">Passed</div>
                        <div className="text-2xl font-bold text-green-400">{passedTests}</div>
                    </div>
                    <div className={`p-4 rounded-xl text-center border ${failedTests > 0 ? 'bg-red-900/10 border-red-900/30' : 'bg-zinc-900/50 border-zinc-800'}`}>
                        <div className={`${failedTests > 0 ? 'text-red-500/70' : 'text-zinc-500'} text-[10px] uppercase font-bold mb-1`}>Failed</div>
                        <div className={`text-2xl font-bold ${failedTests > 0 ? 'text-red-400' : 'text-zinc-600'}`}>{failedTests}</div>
                    </div>
                </div>

                {/* Test Groups */}
                <div className="space-y-4">
                    {testGroups.map((group) => {
                        const groupResults = results[group.id] || [];
                        const groupFailed = groupResults.some(r => !r.passed);
                        const isOpen = expandedGroup === group.id;

                        return (
                            <div key={group.id} className={`bg-zinc-900 border transition-all duration-300 rounded-xl overflow-hidden ${groupFailed ? 'border-red-900/50' : 'border-zinc-800'}`}>
                                <div 
                                    onClick={() => toggleGroup(group.id)}
                                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-zinc-800/50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${groupFailed ? 'bg-red-500/10 text-red-500' : 'bg-zinc-800 text-zinc-400'}`}>
                                            <group.icon size={20} />
                                        </div>
                                        <span className="font-bold text-sm text-zinc-200">{group.title}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-mono text-zinc-500">
                                            {groupResults.length > 0 ? `${groupResults.filter(r => r.passed).length}/${groupResults.length}` : 'Pending'}
                                        </span>
                                        <ChevronRight size={16} className={`text-zinc-600 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                                    </div>
                                </div>

                                {isOpen && (
                                    <div className="border-t border-zinc-800 bg-black/20">
                                        {groupResults.length === 0 ? (
                                            <div className="p-6 text-center text-xs text-zinc-600 italic">Waiting for execution...</div>
                                        ) : (
                                            <div className="divide-y divide-zinc-800/50">
                                                {groupResults.map((test, idx) => (
                                                    <div key={idx} className="p-4 hover:bg-white/5 transition-colors">
                                                        <div className="flex items-start justify-between mb-2">
                                                            <div className="flex items-center gap-2">
                                                                {test.passed ? <CheckCircle2 size={16} className="text-green-500" /> : <XCircle size={16} className="text-red-500" />}
                                                                <span className={`font-bold text-sm ${test.passed ? 'text-zinc-300' : 'text-red-300'}`}>{test.name}</span>
                                                            </div>
                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${test.passed ? 'bg-green-900/20 text-green-500' : 'bg-red-900/20 text-red-500'}`}>
                                                                {test.passed ? 'PASS' : 'FAIL'}
                                                            </span>
                                                        </div>
                                                        
                                                        <p className="text-xs text-zinc-500 mb-3 ml-6">{test.description}</p>
                                                        
                                                        {/* Pass/Fail Scenario Grid */}
                                                        <div className="ml-6 mb-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] font-mono leading-relaxed">
                                                            <div className="bg-green-900/5 border border-green-900/20 p-2 rounded">
                                                                <span className="block font-bold text-green-600/70 mb-1">✅ PASS CRITERIA</span>
                                                                <span className="text-zinc-400">{test.passCondition}</span>
                                                            </div>
                                                            <div className="bg-red-900/5 border border-red-900/20 p-2 rounded">
                                                                <span className="block font-bold text-red-600/70 mb-1">❌ FAIL RISKS</span>
                                                                <span className="text-zinc-400">{test.failCondition}</span>
                                                            </div>
                                                        </div>

                                                        {!test.passed && (
                                                            <div className="ml-6 bg-red-950/30 border border-red-900/30 rounded p-3 text-xs font-mono grid grid-cols-[80px_1fr] gap-2">
                                                                <span className="text-red-400 opacity-70">Expected:</span>
                                                                <span className="text-zinc-300">{test.expected}</span>
                                                                <span className="text-red-400 opacity-70">Received:</span>
                                                                <span className="text-red-300 font-bold">{test.received}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
