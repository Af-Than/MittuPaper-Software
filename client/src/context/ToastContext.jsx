import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);
const STYLES = {
  success: { icon: CheckCircle2, cls: 'border-line text-success' },
  error: { icon: AlertCircle, cls: 'border-line text-danger' },
  info: { icon: Info, cls: 'border-line text-primary' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const id = useRef(0);

  const dismiss = useCallback((tid) => setToasts((t) => t.filter((x) => x.id !== tid)), []);
  const push = useCallback(
    (type, message) => {
      const tid = ++id.current;
      setToasts((t) => [...t.slice(-3), { id: tid, type, message }]);
      setTimeout(() => dismiss(tid), type === 'error' ? 6000 : 3500);
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="no-print pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(92vw,380px)] flex-col gap-2" aria-live="polite">
        {toasts.map((t) => {
          const { icon: Icon, cls } = STYLES[t.type];
          return (
            <div key={t.id} role={t.type === 'error' ? 'alert' : 'status'} className={`pop-in pointer-events-auto flex items-start gap-3 rounded-lg border bg-surface p-3 shadow-lift ${cls}`}>
              <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              <p className="flex-1 text-sm text-ink">{t.message}</p>
              <button onClick={() => dismiss(t.id)} className="rounded p-0.5 text-ink-muted hover:text-ink" aria-label="Dismiss notification">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
