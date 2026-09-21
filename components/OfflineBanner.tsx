import React, { useEffect, useState } from 'react';
import { WifiOff, RefreshCw, X, Download } from 'lucide-react';

/**
 * components/OfflineBanner.tsx — индикатор состояния сети и доступного обновления.
 * T-158: дизайн — preset «Takram»: мягкие скругления, спокойные тени, без декоративного шума.
 */
interface OfflineBannerProps {
  updateAvailable?: boolean;
  onApplyUpdate?: () => void;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({ updateAvailable, onApplyUpdate }) => {
  const [offline, setOffline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine === false : false);
  const [dismissedUpdate, setDismissedUpdate] = useState(false);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  const showUpdate = Boolean(updateAvailable) && !dismissedUpdate && !offline;
  if (!offline && !showUpdate) return null;

  return (
    <div className="fixed left-0 right-0 z-[70] px-3 pointer-events-none" style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' }}>
      <div className="max-w-2xl mx-auto pointer-events-auto">
        {offline && (
          <div data-testid="offline-banner" className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-zinc-900/95 backdrop-blur px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,.35)]">
            <span className="mt-0.5 text-amber-400"><WifiOff size={18} /></span>
            <div className="flex-1">
              <div className="text-sm font-semibold text-zinc-100">Нет сети — работаем офлайн</div>
              <div className="text-xs text-zinc-400 mt-0.5">Открытые проекты и транскрипты доступны. Изменения синхронизируются, когда появится соединение.</div>
            </div>
          </div>
        )}
        {showUpdate && (
          <div data-testid="update-banner" className="mt-2 flex items-center gap-3 rounded-2xl border border-indigo-500/30 bg-zinc-900/95 backdrop-blur px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,.35)]">
            <span className="text-indigo-400"><Download size={18} /></span>
            <div className="flex-1">
              <div className="text-sm font-semibold text-zinc-100">Доступно обновление</div>
              <div className="text-xs text-zinc-400 mt-0.5">Загружена новая версия приложения.</div>
            </div>
            <button onClick={onApplyUpdate} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-bold text-white">
              <RefreshCw size={12} /> Обновить
            </button>
            <button aria-label="Скрыть" onClick={() => setDismissedUpdate(true)} className="text-zinc-500 hover:text-zinc-300 p-1"><X size={14} /></button>
          </div>
        )}
      </div>
    </div>
  );
};
