import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Play, CheckCircle2, XCircle, Loader2, Terminal, AlertTriangle, Bug, Activity, ShieldCheck } from 'lucide-react';
import { TEST_SUITE, TestGroup, TestResult } from '../services/testSuite';
import { useAppVersion } from '../hooks/useAppVersion';

export const TestRunner: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [results, setResults] = useState<Record<string, TestResult[]>>({});
    const [isRunning, setIsRunning] = useState(false);
    const [activeGroup, setActiveGroup] = useState<string | null>(null);
    const [logs, setLogs] = useState<string[]>([]);
    
    const { version } = useAppVersion();
    const consoleRef = useRef<HTMLDivElement>(null);

    const addLog = (msg: string) => {
        const time = new Date().toLocaleTimeString('en-US', { hour12: false, fractionalSecondDigits: 3 } as any);
        setLogs(prev => [...prev, `[${time}] ${msg}`]);
    };

    // Auto-scroll console
    useEffect(() => {
        if (consoleRef.current) {
            consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
        }
    }, [logs]);

    const runTests = async (group?: TestGroup) => {
        if (isRunning) return;
        setIsRunning(true);
        
        const groupsToRun = group ? [group] : TEST_SUITE;
        
        if (!group) {
            setResults({});
            setLogs([]);
            addLog(">>> INITIALIZING FULL SYSTEM DIAGNOSTIC...");
        } else {
            addLog(`>>> RUNNING GROUP: ${group.title.toUpperCase()}...`);
        }

        for (const g of groupsToRun) {
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
                const status = passed === total ? "OK" : "FAILED";
                addLog(`Finished ${g.id}: ${passed}/${total} passed. [${status}]`);

                groupResults.forEach(r => {
                    if (!r.passed) addLog(`  ❌ ERROR: ${r.name} - ${r.failCondition}`);
                });

            } catch (e: any) {
                addLog(`!!! CRITICAL ERROR in ${g.id}: ${e.message}`);
                setResults(prev => ({ ...prev, [g.id]: [{
                    name: 'CRITICAL CRASH',
                    passed: false,
                    description: 'Suite crashed',
                    passCondition: '-',
                    failCondition: e.message,
                    received: 'Exception',
                    expected: 'No Exception'
                }]}));
            }
        }

        addLog(">>> DIAGNOSTIC COMPLETE.");
        setIsRunning(false);
        setActiveGroup(null);
    };

    // Calculate Stats
    const allResults = Object.values(results).flat();
    const totalTests = allResults.length;
    const passedTests = allResults.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    const healthScore = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;

    return (
        <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-indigo-500/30 flex flex-col">
            
            {/* Header */}
            <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-20">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-white">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <Activity className="text-indigo-500" />
                            System Diagnostics
                        </h1>
                        <p className="text-xs text-zinc-500 font-mono">Anotee {version} Test Environment</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-6">
                    <div className="text-right hidden md:block">
                        <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Health Score</div>
                        <div className={`text-xl font-mono font-bold ${healthScore === 100 ? 'text-green-500' : (healthScore > 50 ? 'text-yellow-500' : 'text-red-500')}`}>
                            {totalTests === 0 ? '--' : `${healthScore}%`}
                        </div>
                    </div>
                    <button 
                        onClick={() => runTests()} 
                        disabled={isRunning}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-all shadow-lg ${isRunning ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/20'}`}
                    >
                        {isRunning ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
                        {isRunning ? 'Running...' : 'Run Full Suite'}
                    </button>
                </div>
            </header>

            <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden h-[calc(100vh-80px)]">
                
                {/* Left Col: Test Groups Grid */}
                <div className="lg:col-span-8 overflow-y-auto pr-2 pb-20">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {TEST_SUITE.map((group) => {
                            const groupResults = results[group.id];
                            const isPending = !groupResults;
                            const hasFailures = groupResults?.some(r => !r.passed);
                            const isActive = activeGroup === group.id;

                            return (
                                <div key={group.id} className={`bg-zinc-900 border rounded-xl p-5 transition-all relative overflow-hidden group ${isActive ? 'border-indigo-500 ring-1 ring-indigo-500/50' : (hasFailures ? 'border-red-900/50 bg-red-950/10' : 'border-zinc-800 hover:border-zinc-700')}`}>
                                    {isActive && <div className="absolute top-0 left-0 right-0 h-0.5 bg-indigo-500 animate-pulse-fast"></div>}
                                    
                                    <div className="flex justify-between items-start mb-3">
                                        <div className={`p-2.5 rounded-lg ${hasFailures ? 'bg-red-500/20 text-red-400' : 'bg-zinc-800 text-zinc-400 group-hover:text-white'}`}>
                                            <group.icon size={20} />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {groupResults && (
                                                <span className={`text-xs font-mono px-2 py-0.5 rounded border ${hasFailures ? 'bg-red-900/30 text-red-400 border-red-800' : 'bg-green-900/30 text-green-400 border-green-800'}`}>
                                                    {groupResults.filter((r: TestResult) => r.passed).length}/{groupResults.length}
                                                </span>
                                            )}
                                            <button onClick={() => runTests(group)} disabled={isRunning} className="p-1.5 hover:bg-white/10 rounded text-zinc-500 hover:text-white transition-colors" title="Run this group">
                                                <Play size={14} />
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <h3 className="font-bold text-zinc-200 mb-1">{group.title}</h3>
                                    <p className="text-xs text-zinc-500 mb-4 h-8 line-clamp-2">{group.description}</p>

                                    {/* Detailed Results List (Inline) */}
                                    {!isPending && (
                                        <div className="space-y-2 border-t border-zinc-800 pt-3">
                                            {groupResults.map((res, i) => (
                                                <div key={i} className="flex items-start gap-3 text-xs">
                                                    <div className="mt-0.5 shrink-0">
                                                        {res.passed ? <CheckCircle2 size={14} className="text-green-600" /> : <XCircle size={14} className="text-red-500" />}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className={`font-medium truncate ${res.passed ? 'text-zinc-400' : 'text-red-300'}`}>{res.name}</div>
                                                        {!res.passed && (
                                                            <div className="mt-1 bg-red-950/30 border border-red-900/30 p-2 rounded text-[10px] font-mono text-red-200/70">
                                                                <div>Exp: {res.expected}</div>
                                                                <div className="font-bold text-red-400">Rec: {res.received}</div>
                                                                <div className="mt-1 opacity-70 italic">{res.failCondition}</div>
                                                            </div>
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
                <div className="lg:col-span-4 flex flex-col gap-6 h-full">
                    
                    {/* Stats Card */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <ShieldCheck size={14} /> Executive Summary
                        </h3>
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800">
                                <div className="text-2xl font-bold text-white">{totalTests}</div>
                                <div className="text-[10px] text-zinc-500 uppercase">Total</div>
                            </div>
                            <div className="bg-green-900/10 p-3 rounded-lg border border-green-900/30">
                                <div className="text-2xl font-bold text-green-500">{passedTests}</div>
                                <div className="text-[10px] text-green-600 uppercase">Passed</div>
                            </div>
                            <div className={`p-3 rounded-lg border ${failedTests > 0 ? 'bg-red-900/10 border-red-900/30' : 'bg-zinc-950 border-zinc-800'}`}>
                                <div className={`text-2xl font-bold ${failedTests > 0 ? 'text-red-500' : 'text-zinc-600'}`}>{failedTests}</div>
                                <div className={`text-[10px] uppercase ${failedTests > 0 ? 'text-red-600' : 'text-zinc-600'}`}>Failed</div>
                            </div>
                        </div>
                        {failedTests > 0 && (
                            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2 text-xs text-red-300">
                                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                                <span>System is unstable. Check console logs for critical errors.</span>
                            </div>
                        )}
                    </div>

                    {/* Console Output */}
                    <div className="flex-1 bg-black border border-zinc-800 rounded-xl overflow-hidden flex flex-col font-mono text-xs shadow-inner">
                        <div className="bg-zinc-900 border-b border-zinc-800 px-3 py-2 flex items-center justify-between">
                            <span className="flex items-center gap-2 text-zinc-400 font-bold">
                                <Terminal size={12} /> Console Output
                            </span>
                            <button onClick={() => setLogs([])} className="text-[10px] text-zinc-600 hover:text-white transition-colors">Clear</button>
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
