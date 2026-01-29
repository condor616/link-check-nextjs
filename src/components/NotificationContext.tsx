'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { AlertCircle, CheckCircle, Info, X, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  duration?: number;
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (type: NotificationType, message: string, duration?: number) => void;
  removeNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = (type: NotificationType, message: string, duration = 5000) => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev, { id, type, message, duration }]);
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  };

  useEffect(() => {
    // Check for any settings errors on mount
    const checkSupabaseSettings = async () => {
      // Don't show this warning if we're already on the settings page
      if (typeof window !== 'undefined' && window.location.pathname === '/settings') {
        return;
      }

      try {
        const response = await fetch('/api/settings');
        //...
        const data = await response.json();

        if (data.storageType === 'supabase' && (!data.supabaseUrl || !data.supabaseKey)) {
          addNotification(
            'warning',
            'You have selected Supabase storage but your credentials are incomplete. Please update your settings.',
            10000
          );
        }
      } catch (error) {
        console.error('Error checking settings:', error);
      }
    };

    checkSupabaseSettings();
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, removeNotification }}>
      {children}
      <div
        style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          pointerEvents: 'none',
          width: '100%',
          maxWidth: '500px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px'
        }}
      >
        <AnimatePresence mode="popLayout">
          {notifications.map(notification => (
            <NotificationToast
              key={notification.id}
              notification={notification}
              onClose={() => removeNotification(notification.id)}
            />
          ))}
        </AnimatePresence>
      </div>
    </NotificationContext.Provider>
  );
}

function NotificationToast({
  notification,
  onClose
}: {
  notification: Notification,
  onClose: () => void
}) {
  useEffect(() => {
    if (notification.duration) {
      const timer = setTimeout(() => {
        onClose();
      }, notification.duration);

      return () => clearTimeout(timer);
    }
  }, [notification, onClose]);

  const { type, message } = notification;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-success" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-danger" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-warning" />;
      case 'info':
      default:
        return <Info className="h-5 w-5 text-info" />;
    }
  };

  const getStyle = () => {
    switch (type) {
      case 'success':
        return {
          backgroundColor: '#ecfdf5', // light green
          borderColor: '#10b981',
          color: '#065f46'
        };
      case 'error':
        return {
          backgroundColor: '#fef2f2', // light red
          borderColor: '#ef4444',
          color: '#991b1b'
        };
      case 'warning':
        return {
          backgroundColor: '#fffbeb', // light amber
          borderColor: '#f59e0b',
          color: '#92400e'
        };
      case 'info':
      default:
        return {
          backgroundColor: '#eff6ff', // light blue
          borderColor: '#3b82f6',
          color: '#1e40af'
        };
    }
  };

  const style = getStyle();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 30
      }}
      className="card d-flex flex-row align-items-center gap-3 p-3 shadow-lg border-2"
      style={{
        ...style,
        pointerEvents: 'auto',
        minWidth: '320px',
        maxWidth: '100%',
        borderRadius: '12px'
      }}
    >
      <div className="flex-shrink-0 d-flex align-items-center">
        {getIcon()}
      </div>
      <div className="flex-grow-1 small fw-medium">
        {message}
      </div>
      <button
        onClick={onClose}
        className="btn-close btn-close-dark ms-2"
        aria-label="Close"
        style={{ fontSize: '0.75rem' }}
      ></button>
    </motion.div>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);

  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }

  return context;
} 