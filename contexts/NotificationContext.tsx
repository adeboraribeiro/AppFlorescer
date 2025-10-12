import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, Platform, StyleSheet, Text, View } from 'react-native';

type NotificationType = 'success' | 'error';

type NotificationContextType = {
  showNotification: (message: string, type?: NotificationType, autoHideMs?: number | null) => void;
};

const NotificationContext = createContext<NotificationContextType | null>(null);

// Inline GlobalNotification component to keep notifications in a single file
const GlobalNotification: React.FC<{ visible: boolean; message: string; type?: NotificationType; autoHideMs?: number | null; onHide?: () => void; themeProp?: 'light'|'dark' }> = ({ visible, message, type = 'success', autoHideMs = 1500, onHide, themeProp }) => {
  const isDark = themeProp === 'dark';
  const styles = getThemedStyles(isDark);

  const anim = useRef(new Animated.Value(-120)).current;
  const [show, setShow] = useState(visible);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      setShow(true);
      Animated.spring(anim, {
        toValue: 0,
        tension: 80,
        friction: 10,
        useNativeDriver: true,
      }).start();

      if (autoHideMs) {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => {
          Animated.timing(anim, { toValue: -120, duration: 200, useNativeDriver: true }).start(() => {
            setShow(false);
            onHide && onHide();
          });
        }, autoHideMs);
      }
    } else {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      Animated.timing(anim, { toValue: -120, duration: 200, useNativeDriver: true }).start(() => {
        setShow(false);
        onHide && onHide();
      });
    }
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [visible, autoHideMs, anim, onHide]);

  if (!show) return null;

  return (
    <Modal
      visible={show}
      transparent
      statusBarTranslucent
      animationType="none"
      // On Android, ensure the modal is presented above other system UI
      // Use a large elevation/zIndex inside the content container as well.
    >
      <View pointerEvents="box-none" style={{ flex: 1 }}>
        <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', zIndex: 99999, elevation: 99999 }}>
          <Animated.View style={[styles.notification, type === 'success' ? styles.notificationSuccess : styles.notificationError, { transform: [{ translateY: anim }] }]}>
            <Text style={[styles.notificationText, type === 'success' ? styles.notificationTextSuccess : styles.notificationTextError]}>
              {message.split(/<link>|<\/link>/).map((text, i) => (
                i === 1 ? (
                  <Text key={i} onPress={() => { /* reserved link handler */ }} style={[styles.notificationText, type === 'success' ? styles.notificationTextSuccess : styles.notificationTextError, styles.linkText]}>
                    {text}
                  </Text>
                ) : (
                  <Text key={i} style={[styles.notificationText, type === 'success' ? styles.notificationTextSuccess : styles.notificationTextError]}> {text} </Text>
                )
              ))}
            </Text>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
};

export const NotificationProvider: React.FC<{ children: React.ReactNode; theme?: 'light'|'dark' }> = ({ children, theme }) => {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [type, setType] = useState<NotificationType>('success');
  const [autoHideMs, setAutoHideMs] = useState<number | null>(1500);

  const showNotification = useCallback((msg: string, t: NotificationType = 'success', ms: number | null = 1500) => {
    setMessage(msg);
    setType(t);
    setAutoHideMs(ms);
    setVisible(true);
  }, []);

  const onHide = useCallback(() => {
    setVisible(false);
  }, []);

  const ctx = useMemo(() => ({ showNotification }), [showNotification]);

  return (
    <NotificationContext.Provider value={ctx}>
      {children}
  <GlobalNotification visible={visible} message={message} type={type} autoHideMs={autoHideMs} onHide={onHide} themeProp={theme} />
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be used within NotificationProvider');
  return ctx;
};

export default NotificationContext;

const getThemedStyles = (isDark: boolean) => StyleSheet.create({
  notification: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    padding: 16,
  zIndex: 100000,
  elevation: Platform.OS === 'android' ? 100000 : 8,
    borderRadius: 15,
    borderWidth: 0.7,
    borderColor: '#4DCCC1',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,
  shadowRadius: 6,
  },
  notificationSuccess: {
    backgroundColor: isDark ? 'rgba(14, 46, 44, 0.95)' : '#E6F7F5',
    borderColor: '#4dcc82ff',
  },
  notificationError: {
    backgroundColor: isDark ? 'rgba(14, 46, 44, 0.95)' : '#FFF5F5',
    borderColor: '#EF4444',
  },
  notificationText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
    color: '#4DCCC1',
  },
  notificationTextSuccess: {
    color: '#4dcc82ff',
  },
  notificationTextError: {
    color: '#EF4444',
  },
  linkText: {
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
});
