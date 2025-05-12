'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';

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
      try {
        const response = await fetch('/api/settings');
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
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md">
        {notifications.map(notification => (
          <NotificationToast
            key={notification.id}
            notification={notification}
            onClose={() => removeNotification(notification.id)}
          />
        ))}
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
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-amber-500" />;
      case 'info':
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };
  
  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-amber-50 border-amber-200';
      case 'info':
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };
  
  const getTextColor = () => {
    switch (type) {
      case 'success':
        return 'text-green-800';
      case 'error':
        return 'text-red-800';
      case 'warning':
        return 'text-amber-800';
      case 'info':
      default:
        return 'text-blue-800';
    }
  };

  return (
    <div className={`flex items-start gap-3 p-4 rounded-lg shadow-md border ${getBackgroundColor()} ${getTextColor()} animate-in slide-in-from-right-5`}>
      <div className="flex-shrink-0 mt-0.5">
        {getIcon()}
      </div>
      <div className="flex-1 text-sm">
        {message}
      </div>
      <button onClick={onClose} className="flex-shrink-0">
        <X className="h-5 w-5 opacity-70 hover:opacity-100" />
      </button>
    </div>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  
  return context;
} 