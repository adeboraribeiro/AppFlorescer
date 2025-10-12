import React from 'react';

// Ensure i18n initialized once
import '@/i18n';

import { AuthProvider } from '@/contexts/AuthContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { UserProvider } from '@/contexts/UserContext';

export type ProvidersProps = {
  children: React.ReactNode;
};

export default function Providers({ children }: ProvidersProps) {
  return (
    <AuthProvider>
      <ThemeProvider>
        <UserProvider>
          <SettingsProvider>
            <NotificationProvider>{children}</NotificationProvider>
          </SettingsProvider>
        </UserProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
