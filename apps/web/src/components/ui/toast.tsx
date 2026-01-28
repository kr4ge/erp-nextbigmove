'use client';

import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

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
      <div className="fixed top-4 right-4 z-[9999] space-y-3">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center w-full max-w-sm p-4 text-sm text-slate-800 bg-white border rounded-lg shadow ${
              t.type === 'success' ? 'border-green-200' : t.type === 'error' ? 'border-red-200' : 'border-slate-200'
            }`}
            role="alert"
          >
            <div
              className={`inline-flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-lg ${
                t.type === 'success'
                  ? 'text-green-600 bg-green-100'
                  : t.type === 'error'
                  ? 'text-red-600 bg-red-100'
                  : 'text-slate-600 bg-slate-100'
              }`}
            >
              {t.type === 'success' ? '✓' : t.type === 'error' ? '!' : 'i'}
            </div>
            <div className="ml-3 text-sm font-medium text-slate-900">{t.message}</div>
            <button
              type="button"
              className="ml-auto text-slate-400 hover:text-slate-700"
              onClick={() => removeToast(t.id)}
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
