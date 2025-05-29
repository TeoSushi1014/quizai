
import { useState, useCallback, useEffect, useRef } from 'react';

export type NotificationType = 'error' | 'success' | 'info' | 'warning';

export interface NotificationState {
  type: NotificationType;
  message: string;
  key?: string; // Unique key for React list rendering, can be timestamp or random string
  duration?: number; // Duration in ms, defaults to 5000
}

let notificationKeyCounter = 0;

export const useNotification = () => {
  const [notification, setNotification] = useState<NotificationState | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearNotification = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setNotification(null);
  }, []);

  const showNotification = useCallback((
    type: NotificationType,
    message: string,
    duration: number = 5000,
    key?: string
  ) => {
    clearNotification(); // Clear any existing notification
    const notificationKey = key || `notification-${Date.now()}-${notificationKeyCounter++}`;
    setNotification({ type, message, key: notificationKey, duration });

    timeoutRef.current = setTimeout(() => {
      clearNotification();
    }, duration);
  }, [clearNotification]);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    notification,
    showError: (message: string, duration?: number, key?: string) => showNotification('error', message, duration, key),
    showSuccess: (message: string, duration?: number, key?: string) => showNotification('success', message, duration, key),
    showInfo: (message: string, duration?: number, key?: string) => showNotification('info', message, duration, key),
    showWarning: (message: string, duration?: number, key?: string) => showNotification('warning', message, duration, key),
    clearNotification,
  };
};