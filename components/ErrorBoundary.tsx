import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCw, WifiOff } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      const isChunkError = this.state.error?.name === 'ChunkLoadError' || 
                           this.state.error?.message?.includes('Loading chunk') ||
                           this.state.error?.message?.includes('Importing a module script failed');

      // Specific advice for Russian users blocked by ISP/Cloudflare HTTP/3
      const isLikelyQuicBlock = isChunkError || this.state.error?.message?.includes('NetworkError') || this.state.error?.message?.includes('Failed to fetch');

      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white p-6 text-center animate-in fade-in duration-500">
          <div className="bg-red-500/10 p-6 rounded-full mb-6 ring-1 ring-red-500/30">
            {isChunkError ? <WifiOff size={48} className="text-red-500" /> : <AlertTriangle size={48} className="text-red-500" />}
          </div>
          
          <h1 className="text-2xl font-bold mb-3">
            {isChunkError ? "Ошибка соединения" : "Что-то пошло не так"}
          </h1>
          
          <p className="text-zinc-400 mb-6 max-w-md text-sm leading-relaxed">
            {isChunkError 
                ? "Приложению не удалось загрузить необходимые файлы. Это часто случается из-за нестабильного интернета или блокировок провайдера." 
                : "Произошла непредвиденная ошибка в приложении."
            }
          </p>

          {/* Technical Details */}
          <div className="bg-zinc-900/80 p-4 rounded-lg border border-zinc-800 mb-8 max-w-md w-full overflow-hidden text-left">
             <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Детали ошибки</div>
             <code className="font-mono text-xs text-red-300 block break-words">
                {this.state.error?.message || "Unknown Error"}
             </code>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button
                onClick={() => {
                    // Hard reload ignoring cache
                    window.location.reload();
                }}
                className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-6 py-3 rounded-xl font-bold transition-all shadow-lg hover:scale-[1.02]"
            >
                <RotateCw size={18} />
                Обновить страницу
            </button>

            {isLikelyQuicBlock && (
                <div className="mt-4 text-xs text-zinc-500">
                    <p className="font-bold mb-1 text-zinc-400">Советы по исправлению:</p>
                    <ul className="list-disc pl-4 space-y-1 text-left">
                        <li>Включите <strong>VPN</strong>.</li>
                        <li>Попробуйте открыть сайт через мобильный интернет.</li>
                        <li>Попробуйте другой браузер (Chrome/Firefox).</li>
                    </ul>
                </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}