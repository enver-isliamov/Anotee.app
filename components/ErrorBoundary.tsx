
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white p-4 text-center">
          <div className="bg-red-500/10 p-4 rounded-full mb-4">
            <AlertTriangle size={48} className="text-red-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
          <p className="text-zinc-400 mb-6 max-w-md text-sm">
            The application encountered an unexpected error. 
            <br/>
            <span className="font-mono bg-zinc-900 px-1 rounded text-xs opacity-50 mt-2 inline-block">
                {this.state.error?.message}
            </span>
          </p>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-6 py-3 rounded-lg font-bold transition-colors"
          >
            <RotateCw size={18} />
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
