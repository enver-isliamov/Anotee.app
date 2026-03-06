import React, { useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { CheckCircle2, Loader2, Package, Smartphone, Apple, AlertTriangle } from 'lucide-react';

type BuildStep = {
    target: 'static' | 'ios' | 'android';
    success: boolean;
    stdout?: string;
    stderr?: string;
};

export const AdminBuildTab: React.FC = () => {
    const { getToken } = useAuth();
    const [targetStatic, setTargetStatic] = useState(true);
    const [targetIOS, setTargetIOS] = useState(false);
    const [targetAndroid, setTargetAndroid] = useState(false);
    const [isBuilding, setIsBuilding] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [warnings, setWarnings] = useState<string[]>([]);
    const [steps, setSteps] = useState<BuildStep[]>([]);

    const handleBuild = async () => {
        setIsBuilding(true);
        setMessage(null);
        setWarnings([]);
        setSteps([]);

        try {
            const token = await getToken();
            const response = await fetch('/api/admin?action=build_project', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    targetStatic,
                    targetIOS,
                    targetAndroid
                })
            });

            const data = await response.json();
            if (!response.ok) {
                setMessage(data?.message || data?.error || 'Ошибка сборки');
                setWarnings(data?.warnings || []);
                setSteps(data?.steps || []);
                return;
            }

            setMessage(`${data.message}${data.outputPath ? ` Статический билд: ${data.outputPath}` : ''}`);
            setWarnings(data.warnings || []);
            setSteps(data.steps || []);
        } catch (error) {
            setMessage('Сервер недоступен или произошла ошибка сети.');
        } finally {
            setIsBuilding(false);
        }
    };

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 md:p-6 shadow-sm">
            <div className="mb-5">
                <h2 className="text-lg font-bold flex items-center gap-2">
                    <Package size={18} className="text-indigo-500" /> Сборка проекта
                </h2>
                <p className="text-sm text-zinc-500 mt-1">
                    Запустите сборку сайта для обычного хостинга и при необходимости подготовьте мобильные проекты (iOS/Android).
                </p>
            </div>

            <div className="grid md:grid-cols-3 gap-3 mb-5">
                <label className="flex items-center gap-2 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 cursor-pointer">
                    <input type="checkbox" checked={targetStatic} onChange={(e) => setTargetStatic(e.target.checked)} className="accent-indigo-600" />
                    <span className="font-medium text-sm">Статичный сайт (dist)</span>
                </label>
                <label className="flex items-center gap-2 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 cursor-pointer">
                    <input type="checkbox" checked={targetIOS} onChange={(e) => setTargetIOS(e.target.checked)} className="accent-indigo-600" />
                    <Apple size={16} className="text-zinc-500" />
                    <span className="font-medium text-sm">iOS</span>
                </label>
                <label className="flex items-center gap-2 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 cursor-pointer">
                    <input type="checkbox" checked={targetAndroid} onChange={(e) => setTargetAndroid(e.target.checked)} className="accent-indigo-600" />
                    <Smartphone size={16} className="text-zinc-500" />
                    <span className="font-medium text-sm">Android</span>
                </label>
            </div>

            <button
                onClick={handleBuild}
                disabled={isBuilding || (!targetStatic && !targetIOS && !targetAndroid)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-400 text-white font-semibold text-sm"
            >
                {isBuilding ? <Loader2 size={16} className="animate-spin" /> : <Package size={16} />}
                {isBuilding ? 'Идет сборка...' : 'Запустить сборку'}
            </button>

            {message && (
                <div className="mt-4 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm">
                    {message}
                </div>
            )}

            {warnings.length > 0 && (
                <div className="mt-4 space-y-2">
                    {warnings.map((warning, idx) => (
                        <div key={idx} className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-900 dark:text-amber-300 text-sm flex gap-2">
                            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                            <span>{warning}</span>
                        </div>
                    ))}
                </div>
            )}

            {steps.length > 0 && (
                <div className="mt-5 space-y-3">
                    {steps.map((step) => (
                        <div key={step.target} className="border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 text-sm">
                            <div className="flex items-center gap-2 font-semibold mb-2">
                                {step.success ? (
                                    <CheckCircle2 size={16} className="text-green-600" />
                                ) : (
                                    <AlertTriangle size={16} className="text-red-500" />
                                )}
                                {step.target.toUpperCase()}
                            </div>
                            {!!step.stdout && <pre className="whitespace-pre-wrap text-xs text-zinc-600 dark:text-zinc-300">{step.stdout}</pre>}
                            {!!step.stderr && <pre className="whitespace-pre-wrap text-xs text-red-600 dark:text-red-400 mt-2">{step.stderr}</pre>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
