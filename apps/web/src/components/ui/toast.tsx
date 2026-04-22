'use client';

import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';

type ToastType = 'success' | 'error' | 'info';
type ToastItem = { id: number; type: ToastType; message: string };

type ToastContextType = {
  addToast: (type: ToastType, message: string, timeoutMs?: number) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((type: ToastType, message: string, timeoutMs = 4000) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, timeoutMs);
  }, []);

  const removeToast = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed top-4 right-4 sm:right-8 z-[9999] space-y-3">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center w-full max-w-sm p-4 text-sm text-foreground bg-surface border rounded-lg shadow ${
              t.type === 'success' ? 'border-success' : t.type === 'error' ? 'border-destructive' : 'border-border/80'
            }`}
            role="alert"
          >
            <div
              className={`inline-flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-lg ${
                t.type === 'success'
                  ? 'text-success bg-success-soft'
                  : t.type === 'error'
                  ? 'text-destructive bg-destructive/20'
                  : 'text-muted bg-secondary/80'
              }`}
            >
              {t.type === 'success' ? '✓' : t.type === 'error' ? '!' : 'i'}
            </div>
            <div className="ml-3 mr-2 min-w-0 flex-1 text-sm font-medium text-slate-900">{t.message}</div>
            <button
              type="button"
              className="ml-auto inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-border/70 bg-surface-soft text-slate-500 transition hover:border-border hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200"
              onClick={() => removeToast(t.id)}
              aria-label="Close toast"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
};
