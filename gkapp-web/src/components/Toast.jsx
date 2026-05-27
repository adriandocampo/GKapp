/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

const ToastContext = createContext();
const MAX_TOASTS = 5;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const hoveredToastId = useRef(null);

  const addToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => {
      const next = [...prev, { id, message, type }];
      return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next;
    });
    if (duration > 0) {
      const timer = setTimeout(() => {
        if (hoveredToastId.current !== id) {
          setToasts(prev => prev.filter(t => t.id !== id));
        }
      }, duration);
      return () => clearTimeout(timer);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] space-y-2" style={{maxWidth: 360}}>
        {toasts.map(toast => (
          <div
            key={toast.id}
            onMouseEnter={() => { hoveredToastId.current = toast.id; }}
            onMouseLeave={() => { hoveredToastId.current = null; }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 16px',
              borderRadius: 16,
              background: toast.type === 'success' ? 'rgba(61, 214, 140, 0.12)' :
                          toast.type === 'error' ? 'rgba(224, 74, 74, 0.12)' :
                          toast.type === 'warning' ? 'rgba(240, 180, 41, 0.12)' :
                          'rgba(22, 20, 16, 0.95)',
              backdropFilter: 'blur(16px)',
              border: toast.type === 'success' ? '1px solid rgba(61, 214, 140, 0.20)' :
                      toast.type === 'error' ? '1px solid rgba(224, 74, 74, 0.20)' :
                      toast.type === 'warning' ? '1px solid rgba(240, 180, 41, 0.20)' :
                      '1px solid rgba(185, 165, 135, 0.10)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            }}
          >
            {toast.type === 'success' && <CheckCircle size={18} style={{color: '#3dd68c', flexShrink: 0}} />}
            {toast.type === 'error' && <AlertCircle size={18} style={{color: '#e04a4a', flexShrink: 0}} />}
            {toast.type === 'warning' && <AlertCircle size={18} style={{color: '#f0b429', flexShrink: 0}} />}
            {toast.type === 'info' && <Info size={18} style={{color: '#e8ac65', flexShrink: 0}} />}
            <span className="text-sm flex-1" style={{color: '#f1ede7'}}>{toast.message}</span>
            <button onClick={() => removeToast(toast.id)} style={{color: '#997b66', border: 'none', background: 'none', cursor: 'pointer', flexShrink: 0}}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
