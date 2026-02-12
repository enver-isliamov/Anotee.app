
import React, { useState, useEffect } from 'react';
import { generateEDL, generateResolveXML, generateCSV } from '../services/exportService';
import { generateId, stringToColor, formatTimecode, isExpired, getDaysRemaining } from '../services/utils';
import { Comment, CommentStatus, DEFAULT_CONFIG, DEFAULT_PAYMENT_CONFIG } from '../types';
import { MOCK_PROJECTS } from '../constants';
import { ArrowLeft, CheckCircle2, XCircle, Play, RefreshCw, Calculator, FileOutput, ShieldCheck, ChevronRight, FlaskConical, Clock, Database } from 'lucide-react';

// --- TEST TYPES ---

type TestResult = {
    name: string;
    passed: boolean;
    expected?: string;
    received?: string;
    description: string;
};

type TestGroup = {
    id: string;
    title: string;
    icon: React.ElementType;
    tests: () => TestResult[];
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
                    received: `${framesTotal} frames`
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
                    received: `${framesNtsc} frames`
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
                    received: t1
                });

                const t2 = formatTimecode(65.5, 25); // 1 min 5 sec 12 frames (0.5 * 25 = 12.5 -> 12)
                const t2Expected = '00:01:05:12';
                res.push({
                    name: 'SMPTE Complex Check',
                    description: 'Format 65.5s at 25fps',
                    passed: t2 === t2Expected,
                    expected: t2Expected,
                    received: t2
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
                    received: String(expired)
                });

                const twoDaysAgo = Date.now() - (2 * oneDayMs);
                const remaining = getDaysRemaining(twoDaysAgo, 7);
                res.push({
                    name: 'Days Remaining',
                    description: 'getDaysRemaining(2 days ago, 7 limit)',
                    passed: remaining === 5,
                    expected: '5',
                    received: String(remaining)
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
                    received: hasTitle ? 'Valid Header' : 'Missing Header'
                });

                // Test XML Color Mapping
                const xml = generateResolveXML('Test', 1, mockComments, 24);
                const hasColorRed = xml.includes('<name>Red</name>'); 
                res.push({
                    name: 'XML Color Mapping',
                    description: 'Проверка маппинга цвета (Open Status -> Red Color) для DaVinci.',
                    passed: hasColorRed,
                    expected: '<name>Red</name>',
                    received: hasColorRed ? 'Found <name>Red</name>' : 'Tag Missing'
                });

                // Test CSV Escaping (New)
                const trickyComment = [{ ...mockComments[0], text: 'Hello "World"' }];
                const csv = generateCSV(trickyComment);
                // Expected: "Hello ""World""" (Double quotes escaping)
                const hasEscapedQuotes = csv.includes('""World""');
                res.push({
                    name: 'CSV Sanitization',
                    description: 'Экранирование кавычек в CSV для Excel/Premiere.',
                    passed: hasEscapedQuotes,
                    expected: 'Hello ""World""',
                    received: hasEscapedQuotes ? 'Escaped Correctly' : 'Injection Vulnerable'
                });

                // Test XML Special Char Escaping (New)
                const xmlComment = [{ ...mockComments[0], text: 'Me & You < 3' }];
                const unsafeXml = generateResolveXML('Test', 1, xmlComment, 24);
                const isSafe = unsafeXml.includes('Me &amp; You &lt; 3');
                res.push({
                    name: 'XML Entity Escaping',
                    description: 'Экранирование спецсимволов (& < >) для валидности XML.',
                    passed: isSafe,
                    expected: 'Me &amp; You &lt; 3',
                    received: isSafe ? 'Escaped Correctly' : 'Invalid XML'
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
                
                // Regex check for UUID-like structure (or fallback hex)
                const sampleId = generateId();
                const isValidFormat = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sampleId) || /^[0-9a-f]{30,}$/.test(sampleId); // Fallback is just hex string

                res.push({
                    name: 'ID Generator Collision Test',
                    description: 'Генерация 100 уникальных UUID и проверка на дубликаты.',
                    passed: !collision,
                    expected: '0 Collisions',
                    received: collision ? 'Collision Detected' : 'Unique'
                });

                res.push({
                    name: 'ID Format Check',
                    description: 'Проверка формата ID (UUID v4 or Hex).',
                    passed: isValidFormat,
                    expected: 'UUID / Hex',
                    received: sampleId
                });

                // Test Color Determinism (New)
                const userA = 'user_123';
                const color1 = stringToColor(userA);
                const color2 = stringToColor(userA);
                res.push({
                    name: 'Color Determinism',
                    description: 'Один и тот же UserID должен всегда генерировать одинаковый цвет.',
                    passed: color1 === color2,
                    expected: color1,
                    received: color2
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
                    description: 'Проверка наличия критических флагов в дефолтном конфиге (Fallback).',
                    passed: hasDrive && hasLimit,
                    expected: 'Drive: true, Limit: 3',
                    received: `Drive: ${hasDrive}, Limit: ${DEFAULT_CONFIG.max_projects.limitFree}`
                });

                // 2. Payment Config Structure
                const hasPlans = !!DEFAULT_PAYMENT_CONFIG.plans.free && !!DEFAULT_PAYMENT_CONFIG.plans.lifetime;
                const priceCheck = DEFAULT_PAYMENT_CONFIG.prices.lifetime > 0;
                res.push({
                    name: 'Payment Defaults',
                    description: 'Валидация структуры планов и цен по умолчанию.',
                    passed: hasPlans && priceCheck,
                    expected: 'Plans exist, Price > 0',
                    received: hasPlans ? 'OK' : 'Missing Plans'
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
                    received: hasAssets ? 'OK' : 'Empty Assets'
                });

                return res;
            }
        }
    ];

    const runAllTests = async () => {
        setIsRunning(true);
        setResults({});
        
        // Simulate async work for "system scan" effect
        await new Promise(r => setTimeout(r, 600));

        const newResults: Record<string, TestResult[]> = {};
        
        testGroups.forEach(group => {
            try {
                newResults[group.id] = group.tests();
            } catch (e: any) {
                newResults[group.id] = [{
                    name: 'CRITICAL EXCEPTION',
                    passed: false,
                    description: 'Test suite crashed unexpectedly.',
                    received: e.message,
                    expected: 'No Crash'
                }];
            }
        });

        setResults(newResults);
        setIsRunning(false);
        setExpandedGroup('integrity'); // Open new group to show updates
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
                            <p className="text-xs text-zinc-500 mt-1">Anotee Internal Self-Test Environment v1.3</p>
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
