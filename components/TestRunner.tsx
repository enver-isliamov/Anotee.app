import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    ArrowLeft, Play, CheckCircle2, XCircle, Loader2, Terminal, AlertTriangle, Activity, ShieldCheck,
    RotateCcw, ClipboardCopy, Check, FileDown, FileJson, Lightbulb, ListChecks, Info,
    Monitor, Cpu, Wifi, WifiOff, Globe, Languages, FlaskConical
} from 'lucide-react';
import {
    TEST_SUITE, TestGroup, TestResult, Severity, EnvSummary,
    getSeverity, collectEnvSummary, computeStats, computeHealthScore,
    buildReportMarkdown, formatFileStamp, HEALTH_SCORE_FORMULA
} from '../services/testSuite';
import { useAppVersion } from '../hooks/useAppVersion';
import { useTranslation } from 'react-i18next';

// Копирование с fallback на execCommand (небезопасный контекст/старые браузеры)
const copyTextToClipboard = async (text: string): Promise<boolean> => {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch { /* fallback ниже */ }
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        return ok;
    } catch {
        return false;
    }
};

const downloadFile = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const SEVERITY_BADGE_CLASS: Record<Severity, string> = {
    critical: 'bg-red-500/15 text-red-400 border-red-500/40',
    warning: 'bg-amber-500/15 text-amber-400 border-amber-500/40',
    info: 'bg-sky-500/15 text-sky-400 border-sky-500/40'
};

const SEVERITY_DOT_CLASS: Record<Severity, string> = {
    critical: 'bg-red-500 animate-pulse',
    warning: 'bg-amber-400',
    info: 'bg-sky-400'
};

export const TestRunner: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { t } = useTranslation();
    const { version } = useAppVersion();
    const [results, setResults] = useState<Record<string, TestResult[]>>({});
    const [isRunning, setIsRunning] = useState(false);
    const [activeGroup, setActiveGroup] = useState<string | null>(null);
    const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const [env, setEnv] = useState<EnvSummary | null>(null);
    const [copyState, setCopyState] = useState<{ key: string; ok: boolean } | null>(null);

    const consoleRef = useRef<HTMLDivElement>(null);

    const addLog = (msg: string) => {
        const time = new Date().toLocaleTimeString('en-US', { hour12: false, fractionalSecondDigits: 3 } as any);
        setLogs(prev => [...prev, `[${time}] ${msg}`]);
    };

    // Сводка окружения: при монтировании + resize/online/offline (через state, не в рендере — mobile-чеклист §5)
    useEffect(() => {
        let alive = true;
        collectEnvSummary().then(e => { if (alive) setEnv(e); });
        const onResize = () => setEnv(prev => (prev ? {
            ...prev,
            viewport: { width: window.innerWidth, height: window.innerHeight },
            devicePixelRatio: window.devicePixelRatio || 1
        } : prev));
        const onOnline = () => setEnv(prev => (prev ? { ...prev, online: true } : prev));
        const onOffline = () => setEnv(prev => (prev ? { ...prev, online: false } : prev));
        window.addEventListener('resize', onResize);
        window.addEventListener('online', onOnline);
        window.addEventListener('offline', onOffline);
        return () => {
            alive = false;
            window.removeEventListener('resize', onResize);
            window.removeEventListener('online', onOnline);
            window.removeEventListener('offline', onOffline);
        };
    }, []);

    // Auto-scroll console
    useEffect(() => {
        if (consoleRef.current) {
            consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
        }
    }, [logs]);

    const runGroups = async (groups: TestGroup[], full: boolean) => {
        if (isRunning || groups.length === 0) return;
        setIsRunning(true);
        setProgress({ done: 0, total: groups.length });

        if (full) {
            setResults({});
            setLogs([]);
            addLog(">>> INITIALIZING FULL SYSTEM DIAGNOSTIC...");
        } else {
            addLog(`>>> RE-RUNNING GROUPS WITH FAILURES: ${groups.map(g => g.id).join(', ')}`);
        }

        let done = 0;
        for (const g of groups) {
            setActiveGroup(g.id);
            addLog(`Starting ${g.id} tests...`);

            try {
                // Artificial delay for UI feel
                await new Promise(r => setTimeout(r, 200));

                let groupResults: TestResult[] = [];
                const res = g.tests();

                if (res instanceof Promise) {
                    addLog(`...awaiting async results for ${g.id}`);
                    groupResults = await res;
                } else {
                    groupResults = res;
                }

                setResults(prev => ({ ...prev, [g.id]: groupResults }));

                const passed = groupResults.filter(r => r.passed).length;
                const total = groupResults.length;
                const crits = groupResults.filter(r => !r.passed && getSeverity(r) === 'critical').length;
                const status = passed === total ? "OK" : (crits > 0 ? "CRITICAL FAILURE" : "FAILED");
                addLog(`Finished ${g.id}: ${passed}/${total} passed. [${status}]`);

                groupResults.forEach(r => {
                    if (!r.passed) addLog(`  ❌ ERROR: [${getSeverity(r)}] ${r.name} - ${r.failCondition}`);
                });

            } catch (e: any) {
                addLog(`!!! CRITICAL ERROR in ${g.id}: ${e.message}`);
                setResults(prev => ({ ...prev, [g.id]: [{
                    name: 'CRITICAL CRASH',
                    passed: false,
                    severity: 'critical' as Severity,
                    description: 'Suite crashed',
                    passCondition: '-',
                    failCondition: e.message,
                    received: 'Exception',
                    expected: 'No Exception',
                    diagnosis: `Группа тестов упала с исключением: ${e.message}. Это баг самого теста, а не продукта — проверить консоль и services/testSuite.ts.`,
                    task: `### T-XX Diagnostics: краш тест-группы ${g.id}\n- Приоритет: P1\n- Источник: [diag] System Diagnostics (self-test)\n- Проблема: функция группы ${g.id} бросает исключение: ${e.message}\n- Цель: исправить тест/защитить от исключений в services/testSuite.ts.\n- Acceptance: прогон группы на /test не падает с исключением.`
                }]}));
            }
            done++;
            setProgress({ done, total: groups.length });
        }

        addLog(">>> DIAGNOSTIC COMPLETE.");
        setIsRunning(false);
        setActiveGroup(null);
        setProgress(null);
    };

    const runTests = () => runGroups(TEST_SUITE, true);

    const failedGroups = useMemo(
        () => TEST_SUITE.filter(g => (results[g.id] || []).some(r => !r.passed)),
        [results]
    );

    const runFailedOnly = () => runGroups(failedGroups, false);

    const stats = useMemo(() => computeStats(results), [results]);
    const healthScore = useMemo(() => computeHealthScore(results), [results]);

    const buildReport = () => buildReportMarkdown({ now: new Date(), version, env, results });

    const reportName = () => `diagnostics-${formatFileStamp(new Date())}`;

    const handleCopyReport = async () => {
        const ok = await copyTextToClipboard(buildReport());
        setCopyState({ key: 'report', ok });
        setTimeout(() => setCopyState(null), 2000);
    };

    const handleCopyTask = async (key: string, text: string) => {
        const ok = await copyTextToClipboard(text);
        setCopyState({ key, ok });
        setTimeout(() => setCopyState(null), 2000);
    };

    const handleDownloadMd = () => downloadFile(`${reportName()}.md`, buildReport(), 'text/markdown;charset=utf-8');

    const handleDownloadJson = () => {
        const payload = {
            generatedAt: new Date().toISOString(),
            version,
            env,
            healthScore,
            healthScoreFormula: HEALTH_SCORE_FORMULA,
            groups: results
        };
        downloadFile(`${reportName()}.json`, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
    };

    const actionBtn = 'flex items-center justify-center gap-2 min-h-[40px] px-4 rounded-lg text-sm font-semibold border transition-all disabled:opacity-40 disabled:cursor-not-allowed';

    return (
        <div className="min-h-[100dvh] bg-black text-zinc-100 font-sans selection:bg-indigo-500/30 flex flex-col">

            {/* Header */}
            <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md px-3 sm:px-6 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 sticky top-0 z-20">
                <div className="flex items-center gap-3 min-w-0">
                    <button onClick={onBack} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-white shrink-0" aria-label="Back">
                        <ArrowLeft size={20} />
                    </button>
                    <div className="min-w-0">
                        <h1 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                            <Activity className="text-indigo-500 shrink-0" />
                            System Diagnostics
                        </h1>
                        <p className="text-[10px] sm:text-xs text-zinc-500 font-mono truncate">Anotee {version} Test Environment</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 sm:gap-6 ml-auto">
                    <div className="text-right" title={t('test.health.tooltip')}>
                        <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider flex items-center justify-end gap-1">
                            Health Score <Info size={11} className="text-zinc-600" />
                        </div>
                        <div className={`text-xl font-mono font-bold ${healthScore === null ? 'text-zinc-600' : healthScore === 100 ? 'text-green-500' : (healthScore > 50 ? 'text-yellow-500' : 'text-red-500')}`}>
                            {healthScore === null ? '--' : `${healthScore}%`}
                        </div>
                    </div>
                    <button
                        onClick={runTests}
                        disabled={isRunning}
                        className={`flex items-center justify-center gap-2 min-h-[40px] px-4 sm:px-6 rounded-lg font-bold text-sm transition-all shadow-lg ${isRunning ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/20'}`}
                    >
                        {isRunning ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
                        {isRunning ? 'Running...' : 'Run Full Suite'}
                    </button>
                </div>
            </header>

            {/* Toolbar */}
            <div className="border-b border-zinc-800 bg-zinc-950/60 px-3 sm:px-6 py-2.5 flex flex-wrap items-center gap-2">
                <button
                    onClick={runFailedOnly}
                    disabled={isRunning || failedGroups.length === 0}
                    title={t('test.actions.failed_only_hint')}
                    className={`${actionBtn} border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white`}
                >
                    <RotateCcw size={15} />
                    {t('test.actions.failed_only')}
                    {failedGroups.length > 0 && (
                        <span className="text-[10px] font-mono bg-red-900/40 text-red-300 px-1.5 py-0.5 rounded border border-red-800">{failedGroups.length}</span>
                    )}
                </button>
                <button
                    onClick={handleCopyReport}
                    disabled={isRunning || stats.total === 0}
                    className={`${actionBtn} border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white`}
                >
                    {copyState?.key === 'report' ? (copyState.ok ? <Check size={15} className="text-green-500" /> : <XCircle size={15} className="text-red-500" />) : <ClipboardCopy size={15} />}
                    {copyState?.key === 'report' ? (copyState.ok ? t('test.actions.report_copied') : t('test.actions.copy_failed')) : t('test.actions.copy_report')}
                </button>
                <button
                    onClick={handleDownloadMd}
                    disabled={isRunning || stats.total === 0}
                    className={`${actionBtn} border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white`}
                >
                    <FileDown size={15} />
                    {t('test.actions.download_md')}
                </button>
                <button
                    onClick={handleDownloadJson}
                    disabled={isRunning || stats.total === 0}
                    className={`${actionBtn} border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white`}
                >
                    <FileJson size={15} />
                    {t('test.actions.download_json')}
                </button>
                {progress && (
                    <div className="flex items-center gap-2 ml-auto text-[10px] font-mono text-zinc-400">
                        <span className="whitespace-nowrap">{t('test.progress.group', { done: progress.done, total: progress.total })}</span>
                        <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} />
                        </div>
                    </div>
                )}
            </div>

            {/* Environment panel */}
            <div data-testid="env-panel" className="border-b border-zinc-800 bg-zinc-950/30 px-3 sm:px-6 py-3">
                <div className="max-w-7xl mx-auto">
                    <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2 flex items-center gap-1.5">
                        <FlaskConical size={12} className="text-indigo-500" />
                        {t('test.env.title')}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <EnvChip icon={<Cpu size={13} />} label={t('test.env.version')} value={version} />
                        <EnvChip
                            icon={<ShieldCheck size={13} />}
                            label={t('test.env.mode')}
                            value={env ? (env.mode === 'prod' ? t('test.env.prod') : t('test.env.mock')) : '…'}
                            title={env?.healthDetail}
                            tone={env?.mode === 'prod' ? 'ok' : env ? 'warn' : undefined}
                        />
                        <EnvChip icon={<Globe size={13} />} label={t('test.env.browser')} value={env?.browser ?? '…'} />
                        <EnvChip
                            icon={<Monitor size={13} />}
                            label={t('test.env.viewport')}
                            value={env ? `${env.viewport.width}×${env.viewport.height} @ ${env.devicePixelRatio}x` : '…'}
                        />
                        <EnvChip
                            icon={env ? (env.online ? <Wifi size={13} /> : <WifiOff size={13} />) : <Wifi size={13} />}
                            label={t('test.env.network')}
                            value={env ? (env.online ? t('test.env.online') : t('test.env.offline')) : '…'}
                            tone={env ? (env.online ? 'ok' : 'warn') : undefined}
                        />
                        <EnvChip
                            icon={<Languages size={13} />}
                            label={t('test.env.lang')}
                            value={env ? `${env.browserLanguage} → ${env.appLanguage}` : '…'}
                        />
                    </div>
                </div>
            </div>

            <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">

                {/* Left Col: Test Groups Grid */}
                <div className="lg:col-span-8 min-w-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {TEST_SUITE.map((group) => {
                            const groupResults = results[group.id];
                            const isPending = !groupResults;
                            const failedList = groupResults?.filter(r => !r.passed) || [];
                            const hasFailures = failedList.length > 0;
                            const isActive = activeGroup === group.id;
                            const maxSev: Severity | null = hasFailures
                                ? (failedList.some(r => getSeverity(r) === 'critical') ? 'critical'
                                    : failedList.some(r => getSeverity(r) === 'warning') ? 'warning' : 'info')
                                : null;

                            return (
                                <div key={group.id} className={`bg-zinc-900 border rounded-xl p-4 sm:p-5 transition-all relative overflow-hidden group ${isActive ? 'border-indigo-500 ring-1 ring-indigo-500/50' : (hasFailures ? 'border-red-900/50 bg-red-950/10' : 'border-zinc-800 hover:border-zinc-700')}`}>
                                    {isActive && <div className="absolute top-0 left-0 right-0 h-0.5 bg-indigo-500 animate-pulse-fast"></div>}

                                    <div className="flex justify-between items-start mb-3 gap-2">
                                        <div className={`p-2.5 rounded-lg shrink-0 ${hasFailures ? (maxSev === 'critical' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400') : 'bg-zinc-800 text-zinc-400 group-hover:text-white'}`}>
                                            <group.icon size={20} />
                                        </div>
                                        <div className="flex items-center gap-2 min-w-0">
                                            {groupResults && (
                                                <span className={`text-xs font-mono px-2 py-0.5 rounded border shrink-0 ${hasFailures ? 'bg-red-900/30 text-red-400 border-red-800' : 'bg-green-900/30 text-green-400 border-green-800'}`}>
                                                    {groupResults.filter((r: TestResult) => r.passed).length}/{groupResults.length}
                                                </span>
                                            )}
                                            {maxSev && (
                                                <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${SEVERITY_DOT_CLASS[maxSev]}`} title={t(`test.badge.${maxSev}`)} />
                                            )}
                                            <button onClick={() => runGroups([group], false)} disabled={isRunning} className="p-2 hover:bg-white/10 rounded text-zinc-500 hover:text-white transition-colors shrink-0" title="Run this group">
                                                <Play size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    <h3 className="font-bold text-zinc-200 mb-1 break-words">{group.title}</h3>
                                    <p className="text-xs text-zinc-500 mb-4 line-clamp-2 break-words">{group.description}</p>

                                    {/* Detailed Results List (Inline) */}
                                    {!isPending && (
                                        <div className="space-y-2 border-t border-zinc-800 pt-3">
                                            {groupResults.map((res, i) => (
                                                <div key={i} className="flex items-start gap-3 text-xs">
                                                    <div className="mt-0.5 shrink-0">
                                                        {res.passed ? <CheckCircle2 size={14} className="text-green-600" /> : <XCircle size={14} className="text-red-500" />}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className={`font-medium break-words ${res.passed ? 'text-zinc-400' : 'text-red-300'}`}>{res.name}</div>
                                                        {!res.passed && (
                                                            <FailureCard
                                                                result={res}
                                                                copyKey={`${group.id}::${res.name}`}
                                                                copyState={copyState}
                                                                onCopyTask={handleCopyTask}
                                                                t={t}
                                                            />
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right Col: Console & Stats */}
                <div className="lg:col-span-4 flex flex-col gap-4 sm:gap-6 lg:sticky lg:top-[132px] lg:self-start min-w-0">

                    {/* Stats Card */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 sm:p-5">
                        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <ShieldCheck size={14} /> Executive Summary
                        </h3>
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800">
                                <div className="text-2xl font-bold text-white">{stats.total}</div>
                                <div className="text-[10px] text-zinc-500 uppercase">Total</div>
                            </div>
                            <div className="bg-green-900/10 p-3 rounded-lg border border-green-900/30">
                                <div className="text-2xl font-bold text-green-500">{stats.passed}</div>
                                <div className="text-[10px] text-green-600 uppercase">Passed</div>
                            </div>
                            <div className={`p-3 rounded-lg border ${stats.failed > 0 ? 'bg-red-900/10 border-red-900/30' : 'bg-zinc-950 border-zinc-800'}`}>
                                <div className={`text-2xl font-bold ${stats.failed > 0 ? 'text-red-500' : 'text-zinc-600'}`}>{stats.failed}</div>
                                <div className={`text-[10px] uppercase ${stats.failed > 0 ? 'text-red-600' : 'text-zinc-600'}`}>Failed</div>
                            </div>
                        </div>
                        {stats.failed > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-mono">
                                {stats.criticalFails > 0 && (
                                    <span className="px-2 py-1 rounded border border-red-800 bg-red-900/30 text-red-300">critical: {stats.criticalFails}</span>
                                )}
                                {stats.warningFails > 0 && (
                                    <span className="px-2 py-1 rounded border border-amber-800 bg-amber-900/30 text-amber-300">warning: {stats.warningFails}</span>
                                )}
                                {stats.infoFails > 0 && (
                                    <span className="px-2 py-1 rounded border border-sky-800 bg-sky-900/30 text-sky-300">info: {stats.infoFails}</span>
                                )}
                            </div>
                        )}
                        {stats.failed > 0 && (
                            <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2 text-xs text-red-300">
                                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                                <span className="break-words">{stats.criticalFails > 0 ? 'System is unstable: критические падения. У карточек падений — гипотеза и готовая задача.' : 'Есть падения. У карточек падений — гипотеза и готовая задача.'}</span>
                            </div>
                        )}
                    </div>

                    {/* Console Output */}
                    <div className="bg-black border border-zinc-800 rounded-xl overflow-hidden flex flex-col font-mono text-xs shadow-inner h-64 lg:h-[48vh]">
                        <div className="bg-zinc-900 border-b border-zinc-800 px-3 py-2 flex items-center justify-between">
                            <span className="flex items-center gap-2 text-zinc-400 font-bold">
                                <Terminal size={12} /> Console Output
                            </span>
                            <button onClick={() => setLogs([])} className="text-[10px] text-zinc-600 hover:text-white transition-colors min-h-[24px] px-2">Clear</button>
                        </div>
                        <div ref={consoleRef} className="flex-1 overflow-y-auto p-3 space-y-1 text-zinc-300">
                            {logs.length === 0 && <span className="text-zinc-700 italic">Ready to run tests...</span>}
                            {logs.map((log, i) => (
                                <div key={i} className={`break-all ${log.includes('ERROR') ? 'text-red-400' : (log.includes('COMPLETE') ? 'text-green-400 font-bold' : '')}`}>
                                    {log}
                                </div>
                            ))}
                            {isRunning && <div className="animate-pulse text-indigo-500">_</div>}
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
};

// --- Чип панели «Окружение» ---------------------------------

const EnvChip: React.FC<{ icon: React.ReactNode; label: string; value: string; title?: string; tone?: 'ok' | 'warn' }> = ({ icon, label, value, title, tone }) => (
    <div
        title={title || label}
        className={`inline-flex items-center gap-1.5 max-w-full min-w-0 border rounded-lg px-2.5 py-1.5 text-xs ${tone === 'ok'
            ? 'border-green-800/60 bg-green-900/20 text-green-300'
            : tone === 'warn'
                ? 'border-amber-800/60 bg-amber-900/20 text-amber-300'
                : 'border-zinc-800 bg-zinc-900 text-zinc-300'}`}
    >
        <span className="shrink-0 opacity-70">{icon}</span>
        <span className="text-zinc-500 hidden sm:inline">{label}:</span>
        <span className="font-mono font-semibold break-words min-w-0">{value}</span>
    </div>
);

// --- Карточка упавшего теста --------------------------------

const FailureCard: React.FC<{
    result: TestResult;
    copyKey: string;
    copyState: { key: string; ok: boolean } | null;
    onCopyTask: (key: string, text: string) => void;
    t: (key: string) => string;
}> = ({ result, copyKey, copyState, onCopyTask, t }) => {
    const sev = getSeverity(result);
    const copied = copyState?.key === copyKey && copyState.ok;
    const copyFailed = copyState?.key === copyKey && !copyState.ok;

    return (
        <div data-testid="failure-card" className="mt-1.5 bg-red-950/20 border border-red-900/40 rounded-lg p-2.5 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${SEVERITY_BADGE_CLASS[sev]}`}>
                    {t(`test.badge.${sev}`)}
                </span>
                <span className="text-[10px] font-mono text-red-300/80 break-words min-w-0">Exp: {result.expected}</span>
            </div>
            <div className="text-[10px] font-mono text-red-200/90 break-words">
                Rec: <span className="font-bold text-red-400">{result.received}</span>
            </div>
            {result.diagnosis && (
                <div className="flex items-start gap-1.5 text-[11px] text-amber-200/90">
                    <Lightbulb size={12} className="mt-0.5 shrink-0 text-amber-400" />
                    <div className="min-w-0">
                        <span className="font-bold">{t('test.card.why')}:</span>{' '}
                        <span className="break-words">{result.diagnosis}</span>
                    </div>
                </div>
            )}
            {result.task && (
                <div className="rounded-md border border-zinc-700/60 bg-black/40 overflow-hidden">
                    <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-zinc-700/60 bg-zinc-900/60">
                        <span className="text-[10px] font-bold text-zinc-400 flex items-center gap-1.5 min-w-0">
                            <ListChecks size={11} className="shrink-0 text-indigo-400" />
                            <span className="truncate">{t('test.card.task')}</span>
                        </span>
                        <button
                            data-testid="copy-task-button"
                            onClick={() => onCopyTask(copyKey, result.task!)}
                            className={`flex items-center gap-1.5 min-h-[40px] px-3 rounded-md text-[11px] font-semibold border transition-colors shrink-0 ${copied
                                ? 'border-green-700 bg-green-900/30 text-green-300'
                                : copyFailed
                                    ? 'border-red-700 bg-red-900/30 text-red-300'
                                    : 'border-zinc-600 bg-zinc-800 text-zinc-200 hover:bg-zinc-700'}`}
                        >
                            {copied ? <Check size={12} /> : <ClipboardCopy size={12} />}
                            {copied ? t('test.card.task_copied') : copyFailed ? t('test.actions.copy_failed') : t('test.card.copy_task')}
                        </button>
                    </div>
                    <pre className="max-h-44 overflow-y-auto px-2 py-2 text-[10px] leading-relaxed font-mono text-zinc-300 whitespace-pre-wrap break-words">{result.task}</pre>
                </div>
            )}
        </div>
    );
};
