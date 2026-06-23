'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

type ToastItem = {
  id: number;
  type: ToastType;
  message: string;
};

type ToastContextType = {
  addToast: (type: ToastType, message: string, timeoutMs?: number) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((type: ToastType, message: string, timeoutMs = 4000) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, type, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, timeoutMs);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed right-4 top-4 z-[9999] space-y-3 sm:right-8">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="alert"
            className={`flex w-full max-w-sm items-center rounded-lg border bg-white p-4 text-sm text-slate-900 shadow ${
              toast.type === 'success'
                ? 'border-emerald-500'
                : toast.type === 'error'
                  ? 'border-rose-500'
                  : 'border-[#dce4ea]'
            }`}
          >
            <div
              className={`inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
                toast.type === 'success'
                  ? 'bg-emerald-50 text-emerald-600'
                  : toast.type === 'error'
                    ? 'bg-rose-50 text-rose-600'
                    : 'bg-slate-100 text-slate-500'
              }`}
            >
              {toast.type === 'success' ? '✓' : toast.type === 'error' ? '!' : 'i'}
            </div>
            <div className="ml-3 mr-2 min-w-0 flex-1 text-sm font-medium text-slate-900">
              {toast.message}
            </div>
            <button
              type="button"
              aria-label="Close toast"
              onClick={() => removeToast(toast.id)}
              className="ml-auto inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-[#dce4ea] bg-[#fbfcfc] text-slate-500 transition hover:border-[#c6d4dd] hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  return context;
}
