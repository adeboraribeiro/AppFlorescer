import React, { createContext, useContext, useState } from 'react';

type ThemeType = 'light' | 'dark';

interface ThemeContextType {
  theme: ThemeType;
  toggleTheme: () => void;
  setTheme: (t: ThemeType) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeType>('dark');

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'dark' ? 'light' : 'dark');
  };

  // deterministic setter to avoid flip-flop toggles when applying persisted preferences
  const setThemeDeterministic = (t: ThemeType) => {
    setTheme(t);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme: setThemeDeterministic }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    // Defensive fallback: return a default theme to avoid crashing during
    // partial mounts or rapid reloads. Log to aid debugging.
    // eslint-disable-next-line no-console
    console.warn('useTheme called outside ThemeProvider - returning fallback theme');
    return { theme: 'dark', toggleTheme: () => {}, setTheme: () => {} } as ThemeContextType;
  }
  return context;
}
