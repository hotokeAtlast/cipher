import React, { createContext, useContext, useState, useCallback } from 'react';

// 1. Create the Context
const ToastContext = createContext();

// 2. The Provider (Wraps the app)
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  // The function every component will use to trigger a toast
  const addToast = useCallback((message, type = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto-delete after 3 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      
      {/* 3. The Render Area (Bottom Right Corner) */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col space-y-3 pointer-events-none">
        {toasts.map((toast) => (
          <Toast key={toast.id} message={toast.message} type={toast.type} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// 4. The Individual Toast UI Component
const Toast = ({ message, type }) => {
  // Map types to OLED-friendly accent colors
  const typeStyles = {
    success: 'border-[#23a559] text-[#23a559]',
    error: 'border-red-500 text-red-400',
    info: 'border-blue-500 text-blue-400'
  };

  return (
    <div className={`bg-[#1e1f22] border-l-4 ${typeStyles[type] || typeStyles.info} px-5 py-3.5 rounded shadow-2xl flex items-center justify-between min-w-[280px] animate-fade-in pointer-events-auto`}>
      <span className="text-sm font-medium text-[#f2f3f5]">{message}</span>
    </div>
  );
};

// 5. The Custom Hook (For easy importing)
export const useToast = () => useContext(ToastContext);