import React, { useState, useEffect, useRef } from 'react';
import { Clapperboard, MessageSquare, Loader2, ShieldCheck, AlertTriangle, Send } from 'lucide-react';

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
  // T-14x: если <video> не смог загрузить файл (ссылка истекла, файл недоступен) —
  // показываем понятное сообщение вместо чёрного прямоугольника.
  const [videoFailed, setVideoFailed] = useState(false);
  // T-369: гость может оставить комментарий (имя + текст; таймкод — текущий момент видео).
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [guestName, setGuestName] = useState<string>(() => {
    try { return localStorage.getItem('anotee_guest_name') || ''; } catch { return ''; }
  });
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const handleSend = async () => {
    const content = commentText.trim();
    if (!content || sendingComment) return;
    setSendingComment(true);
    setSendError(null);
    const ts = videoRef.current && Number.isFinite(videoRef.current.currentTime) ? videoRef.current.currentTime : 0;
    const authorName = guestName.trim() || 'Гость';
    try {
      if (isMockMode) {
        // demo/e2e: без сети — комментарий добавляется локально
        const c: PublicComment = { id: 'g' + Date.now(), authorName, text: content, timestamp: ts, status: 'OPEN' };
        setPayload((prev) => (prev ? { ...prev, comments: [...prev.comments, c] } : prev));
      } else {
        const res = await fetch('/api/data?action=public_comment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, content, authorName, timestamp: ts }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
        setPayload((prev) => (prev ? { ...prev, comments: [...prev.comments, data.comment] } : prev));
      }
      try { localStorage.setItem('anotee_guest_name', guestName.trim()); } catch { /* ignore */ }
      setCommentText('');
    } catch (e: any) {
      setSendError(e?.message || 'Не удалось отправить');
    } finally {
      setSendingComment(false);
    }
  };

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (isMockMode) {
        // mock: демо-просмотр без сети (для e2e и локальной разработки)
        setTimeout(() => {
          if (!alive) return;
          setVideoFailed(false);
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
          if (alive) { setVideoFailed(false); setPayload(data); }
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
              {payload.videoUrl && !videoFailed ? (
                <video
                  ref={videoRef}
                  src={payload.videoUrl}
                  controls
                  playsInline
                  className="w-full aspect-video bg-black"
                  onError={() => setVideoFailed(true)}
                />
              ) : (
                <div className="w-full aspect-video flex flex-col items-center justify-center text-zinc-500 gap-2 px-4 text-center" data-testid="public-video-unavailable">
                  <Clapperboard size={28} />
                  <p className="text-xs">
                    {videoFailed
                      ? 'Не удалось загрузить видео — возможно, ссылка устарела или файл недоступен.'
                      : isMockMode
                        ? 'Demo: видео недоступно в mock-режиме'
                        : 'Видео обрабатывается — попробуй позже'}
                  </p>
                  {videoFailed && (
                    <button onClick={() => window.location.reload()} className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 underline">
                      Обновить страницу
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="w-full max-w-3xl" data-testid="public-comments">
              <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-wider text-zinc-400"><MessageSquare size={14} /> Комментарии ({payload.comments.length})</div>
              <div className="mt-2 mb-3 flex flex-col gap-2" data-testid="guest-comment-form">
                <div className="flex gap-2">
                  <input
                    data-testid="guest-comment-name"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    maxLength={60}
                    placeholder="Ваше имя"
                    className="w-32 shrink-0 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50"
                  />
                  <input
                    data-testid="guest-comment-text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleSend(); }}
                    maxLength={2000}
                    placeholder="Комментарий к текущему моменту видео…"
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50"
                  />
                  <button
                    data-testid="guest-comment-send"
                    onClick={() => void handleSend()}
                    disabled={!commentText.trim() || sendingComment}
                    className="shrink-0 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold disabled:opacity-50 flex items-center gap-1"
                  >
                    {sendingComment ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Отправить
                  </button>
                </div>
                {sendError && <p className="text-[10px] text-red-400">{sendError}</p>}
              </div>
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
            <p className="text-[10px] text-zinc-600 pb-6">Гостевой доступ — просмотр и комментарии к этой версии. <span className="text-zinc-500">Powered by Anotee</span></p>
          </>
        )}
      </main>
    </div>
  );
};
