import React from 'react';

// Ensure i18n initialized once
import '@/i18n';

// AuthProvider is intentionally not included here to avoid nested providers.
// The application root (`app/_layout.tsx`) mounts AuthProvider once for the app lifecycle.
import { NotificationProvider } from '@/contexts/NotificationContext';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { UserProvider } from '@/contexts/UserContext';

export type ProvidersProps = {
  children: React.ReactNode;
};

export default function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider>
      <UserProvider>
        <SettingsProvider>
          <NotificationProvider>{children}</NotificationProvider>
        </SettingsProvider>
      </UserProvider>
    </ThemeProvider>
  );
}
