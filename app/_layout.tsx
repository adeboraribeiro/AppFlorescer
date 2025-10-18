import { Stack, useSegments } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import KeyChecker from '../components/KeyChecker';
import SafeUserDataProvider from '../components/SafeUserDataProvider';
import SettingsModal from '../components/SettingsModal';
import { AuthProvider } from '../contexts/AuthContext';
import { NotificationProvider } from '../contexts/NotificationContext';
import { SettingsProvider } from '../contexts/SettingsContext';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import { UserProvider } from '../contexts/UserContext';
import '../i18n';
import { supabase } from '../lib/supabase';

function NavigationContent() {
  const { theme } = useTheme();
  const bg = theme === 'dark' ? '#0A1E1C' : '#F7FFFC';
  
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: bg,
        },
        animation: 'fade',
        animationDuration: 200,
      }}
  // Start at the tab layout; tabs layout will route to splash on startup
  initialRouteName="(tabs)"
    >
  {/* Splash is implemented inside the (tabs) group; don't declare a separate root-level splash screen here. */}
      {/* Render the tab layout for normal app navigation */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      {/* Modal is a root-level route (kept for dialogs) */}
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

// Minimal class-based error boundary so we can surface runtime errors in-app
class ErrorCatcher extends React.Component<{ label?: string; children?: React.ReactNode }, { error: Error | null }> {
  constructor(props: any) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(err: Error) {
    return { error: err };
  }

  componentDidCatch(err: Error, info: any) {
    // Log and swallow so UI can show a helpful message
    // eslint-disable-next-line no-console
    console.error('[ErrorCatcher]', this.props.label ?? 'unknown', err, info);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.errContainer}>
          <Text style={styles.errTitle}>Runtime error</Text>
          <Text style={styles.errLabel}>{this.props.label}</Text>
          <Text style={styles.errMsg}>{String(this.state.error?.message ?? this.state.error)}</Text>
        </View>
      );
    }
    // @ts-ignore children are valid
    return this.props.children ?? null;
  }
}

const styles = StyleSheet.create({
  errContainer: { flex: 1, padding: 20, backgroundColor: '#fff', justifyContent: 'center' },
  errTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8, color: '#b91c1c' },
  errLabel: { fontSize: 14, marginBottom: 8, color: '#374151' },
  errMsg: { fontSize: 13, color: '#111827' },
});

export default function RootLayout() {
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const segments = useSegments();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) setUserId(session?.user?.id ?? undefined);
      } catch (e) {
        // don't treat session fetch as fatal; provider can remain without id
        // eslint-disable-next-line no-console
        console.warn('Failed to read local auth session for layout:', e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <SafeAreaProvider>
      <ErrorCatcher label="ThemeProvider">
        <ThemeProvider>
          <ErrorCatcher label="ThemedApp">
            {/* ThemedApp ensures the root background follows the current theme immediately */}
            <ThemedApp>
              <ErrorCatcher label="AuthProvider">
                <AuthProvider>
                  {/* SafeUserDataProvider must be mounted before UserProvider because
                      UserProvider calls useSafeUserData during its initialization. */}
                  <SafeUserDataProvider initialUserId={userId}>
                    <ErrorCatcher label="UserProvider">
                      <UserProvider>
                        <ErrorCatcher label="SettingsProvider">
                          <SettingsProvider>
                              <NavigationContent />
                              {/* Don't mount KeyChecker while the splash is showing inside (tabs).
                                  If segments are not yet available, defer mounting until they are. */}
                              {(() => {
                                const segs: string[] = Array.isArray(segments) ? (segments as any as string[]) : [];
                                if (!segs || segs.length === 0) return null; // wait for router to initialize
                                const inSplash = segs.includes('index') || (segs.length === 1 && segs[0] === '(tabs)');
                                return !inSplash ? <KeyChecker /> : null;
                              })()}
                              <SettingsModal />
                              {/* Warm session passkey & cache shortly after provider mounts */}
                              {/* Import locally to avoid circular import issues at module top-level */}
                              {(() => { const SessionWarmer = require('../components/SessionWarmer').default; return <SessionWarmer />; })()}
                            </SettingsProvider>
                        </ErrorCatcher>
                      </UserProvider>
                    </ErrorCatcher>
                  </SafeUserDataProvider>
                </AuthProvider>
              </ErrorCatcher>
            </ThemedApp>
          </ErrorCatcher>
        </ThemeProvider>
      </ErrorCatcher>
    </SafeAreaProvider>
  );
}

function ThemedApp({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const bg = theme === 'dark' ? '#0A1E1C' : '#F7FFFC';
  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <NotificationProvider theme={theme}>{children}</NotificationProvider>
    </View>
  );
}