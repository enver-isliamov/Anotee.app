import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  label: string;
}

interface State {
  error: Error | null;
}

/** T-30: защитная граница вокруг функционального блока — краш блока
 *  превращается в восстановимую карточку, а не в чёрный экран приложения. */
export class FeatureErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Пишем в консоль полный стек для диагностики (метрика тоже увидит через console.error)
    console.error(`[${this.props.label}] render crash:`, error, info?.componentStack);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-[200px] flex flex-col items-center justify-center text-center p-6 bg-zinc-950 text-zinc-200" data-testid="feature-error">
          <AlertTriangle size={28} className="text-orange-400 mb-3" />
          <p className="text-sm font-bold mb-1">{this.props.label}: ошибка отображения</p>
          <p className="text-[11px] text-zinc-500 mb-4 max-w-[320px] break-words">{String(this.state.error?.message || this.state.error)}</p>
          <button onClick={this.reset} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2">
            <RotateCcw size={14} /> Показать снова
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
