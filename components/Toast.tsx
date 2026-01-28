
import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastProps {
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed top-16 right-4 z-[9999] flex flex-col gap-2 w-full max-w-xs pointer-events-none pr-4 md:pr-0">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onRemove: () => void }> = ({ toast, onRemove }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove();
    }, 2000); // Faster timeout
    return () => clearTimeout(timer);
  }, [onRemove]);

  const icons = {
    success: <CheckCircle size={16} className="text-green-400" />,
    error: <AlertCircle size={16} className="text-red-400" />,
    info: <Info size={16} className="text-blue-400" />
  };

  const bgColors = {
    success: 'bg-zinc-900 border-green-900/50',
    error: 'bg-zinc-900 border-red-900/50',
    info: 'bg-zinc-900 border-blue-900/50'
  };

  return (
    <div className={`pointer-events-auto flex items-center gap-3 p-3 rounded-lg border shadow-xl animate-in slide-in-from-right-full duration-300 ${bgColors[toast.type]}`}>
      <div className="shrink-0">{icons[toast.type]}</div>
      <p className="text-xs text-zinc-200 font-medium flex-1">{toast.message}</p>
      <button onClick={onRemove} className="text-zinc-500 hover:text-white shrink-0">
        <X size={14} />
      </button>
    </div>
  );
};
