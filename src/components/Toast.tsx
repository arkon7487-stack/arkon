import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { setToastPushFn } from '@/lib/notifications/manager';

type ToastType = 'success' | 'error' | 'info';
interface Toast { id: string; type: ToastType; message: string; }

interface ToastContextValue {
  push: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);

  // Wire the toast push function to the NotificationManager
  useEffect(() => {
    setToastPushFn(push);
    return () => setToastPushFn(() => {});
  }, [push]);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'flex items-start gap-3 rounded-xl border px-4 py-3 shadow-card animate-slide-in',
              t.type === 'success' && 'border-success-500/30 bg-success-500/10',
              t.type === 'error' && 'border-danger-500/30 bg-danger-500/10',
              t.type === 'info' && 'border-brand-200 bg-brand-50',
            )}
          >
            {t.type === 'success' && <CheckCircle2 size={18} className="mt-0.5 text-success-500" />}
            {t.type === 'error' && <AlertCircle size={18} className="mt-0.5 text-danger-400" />}
            {t.type === 'info' && <Info size={18} className="mt-0.5 text-brand-600" />}
            <p className="flex-1 text-sm text-slate-900">{t.message}</p>
            <button onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="text-slate-500 hover:text-slate-600">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
