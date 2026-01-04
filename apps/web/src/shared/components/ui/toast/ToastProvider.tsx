import { useState, useCallback, useId, type ReactNode } from 'react';
import { ToastContext, type Toast } from './ToastContext';
import { ToastContainer } from './ToastContainer';

export interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const baseId = useId();
  const [counter, setCounter] = useState(0);

  const addToast = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = `${baseId}-${counter}`;
      setCounter((c) => c + 1);
      const newToast: Toast = { ...toast, id };
      setToasts((prev) => [...prev, newToast]);

      const duration = toast.duration ?? 5000;
      if (duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
      }
    },
    [baseId, counter]
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}
