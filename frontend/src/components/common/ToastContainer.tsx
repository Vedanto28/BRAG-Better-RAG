import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { ToastMessage } from '../../types';

interface ToastContextType {
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (toast: Omit<ToastMessage, 'id'>) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: ToastMessage = { ...toast, id };
      setToasts((prev) => [...prev, newToast]);

      setTimeout(() => {
        removeToast(id);
      }, 4000);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-start gap-3 p-3.5 bg-[#191c22] border border-[#24272f] rounded-xl shadow-xl text-sm animate-slideIn transition-all"
          >
            <div className="mt-0.5 flex-shrink-0">
              {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-[#10b981]" />}
              {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-[#fb7185]" />}
              {toast.type === 'warning' && <AlertCircle className="w-4 h-4 text-[#fbbf24]" />}
              {toast.type === 'info' && <Info className="w-4 h-4 text-[#3b82f6]" />}
            </div>
            <div className="flex-1 min-w-0">
              <h5 className="font-medium text-[#f5f7fa]">{toast.title}</h5>
              {toast.description && <p className="text-xs text-[#6c7280] mt-0.5">{toast.description}</p>}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-[#6c7280] hover:text-[#f5f7fa] p-1 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
