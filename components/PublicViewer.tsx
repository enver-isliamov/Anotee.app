import React, { useState, useEffect } from 'react';
import { Clapperboard, MessageSquare, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';

/**
 * T-21: публичный просмотр одной версии по гостевой ссылке /v/<token>.
 * Без регистрации: токен валидируется на сервере (api/data?action=public_view),
 * гость видит ТОЛЬКО расшаренную версию и её комментарии — остальные разделы недоступны.
 * В mock-режиме (нет ключа Clerk) рендерим демо-данные из constants.
 */

interface PublicComment { id: string; authorName?: string; text: string; timestamp: number; duration?: number; status: string; editKind?: string; }
interface PublicPayload {
  projectName: string; assetTitle: string; versionNumber: number;
  videoUrl: string | null; comments: PublicComment[]; isLocked?: boolean;
}

const formatTs = (s: number) => {
  const total = Math.floor(s); const f = Math.round((s - total) * 30);
  const h = String(Math.floor(total / 3600)).padStart(2, '0');
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const sec = String(total % 60).padStart(2, '0');
  return `${h}:${m}:${sec}:${String(f).padStart(2, '0')}`;
};

export const PublicViewer: React.FC<{ token: string; isMockMode?: boolean }> = ({ token, isMockMode }) => {
  const [payload, setPayload] = useState<PublicPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (isMockMode) {
        // mock: демо-просмотр без сети (для e2e и локальной разработки)
        setTimeout(() => {
          if (!alive) return;
          setPayload({
            projectName: 'Anotee – Commercial Spot X',
            assetTitle: 'Main_Commercial_Cut',
            versionNumber: 2,
            videoUrl: null,
            comments: [{ id: 'g1', authorName: 'Andrey (Creator)', text: 'The color grading here feels too cold', timestamp: 45, status: 'OPEN' }],
            isLocked: false,
          });
          setLoading(false);
        }, 100);
        return;
      }
      try {
        const res = await fetch(`/api/data?action=public_view&token=${encodeURIComponent(token)}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error || `HTTP ${res.status}`);
        } else {
          const data = await res.json();
          if (alive) setPayload(data);
        }
      } catch (e: any) {
        if (alive) setError(e?.message || 'Network error');
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, [token, isMockMode]);

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100 flex flex-col" data-testid="public-viewer">
      <header className="border-b border-zinc-800 px-4 py-3 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Clapperboard size={18} className="text-indigo-400 shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-bold truncate">{payload ? payload.projectName : 'Anotee'}</div>
            {payload && <div className="text-[10px] text-zinc-500 truncate">{payload.assetTitle} · v{payload.versionNumber}</div>}
          </div>
        </div>
        <span className="shrink-0 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400 border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 rounded"><ShieldCheck size={12} /> Guest</span>
      </header>

      <main className="flex-1 flex flex-col items-center justify-start p-3 gap-3 overflow-y-auto">
        {loading && (<div className="flex-1 flex items-center justify-center"><Loader2 size={28} className="animate-spin text-indigo-400" /></div>)}
        {!loading && error && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3" data-testid="public-viewer-error">
            <AlertTriangle size={32} className="text-orange-400" />
            <p className="text-sm font-bold">Ссылка недоступна</p>
            <p className="text-xs text-zinc-500 max-w-[280px]">{error}. Попроси отправителя обновить ссылку.</p>
          </div>
        )}
        {!loading && payload && (
          <>
            <div className="w-full max-w-3xl bg-black rounded-xl overflow-hidden border border-zinc-800">
              {payload.videoUrl ? (
                <video src={payload.videoUrl} controls playsInline className="w-full aspect-video bg-black" />
              ) : (
                <div className="w-full aspect-video flex flex-col items-center justify-center text-zinc-500 gap-2">
                  <Clapperboard size={28} />
                  <p className="text-xs">{isMockMode ? 'Demo: видео недоступно в mock-режиме' : 'Видео обрабатывается — попробуй позже'}</p>
                </div>
              )}
            </div>
            <div className="w-full max-w-3xl" data-testid="public-comments">
              <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-wider text-zinc-400"><MessageSquare size={14} /> Комментарии ({payload.comments.length})</div>
              <div className="space-y-2">
                {payload.comments.length === 0 && <p className="text-xs text-zinc-500">Пока комментариев нет.</p>}
                {payload.comments.map((c) => (
                  <div key={c.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[11px] font-bold text-zinc-300">{c.authorName || 'User'}</span>
                      <span className="text-[10px] font-mono text-indigo-400">{formatTs(c.timestamp)}</span>
                    </div>
                    <p className={`text-xs ${c.editKind === 'delete' ? 'line-through text-red-400' : 'text-zinc-300'}`}>{c.text}</p>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-[10px] text-zinc-600 pb-6">Гостевой доступ — только просмотр этой версии. <span className="text-zinc-500">Powered by Anotee</span></p>
          </>
        )}
      </main>
    </div>
  );
};
