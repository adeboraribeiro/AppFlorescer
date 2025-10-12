import React, { createContext, useContext, useRef, useState } from 'react';

type SettingsContextType = {
  isSettingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
};

const SettingsContext = createContext<SettingsContextType>({
  isSettingsOpen: false,
  openSettings: () => {},
  closeSettings: () => {},
});

export const SettingsProvider = ({ children }: { children: React.ReactNode }) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // Lock to prevent multiple opens in quick succession (defensive guard)
  const openLockRef = useRef(false);

  const openSettings = () => {
    // If already open or an open is in progress, ignore subsequent calls
    if (isSettingsOpen || openLockRef.current) return;
    openLockRef.current = true;
    console.log('Opening settings...');
    setIsSettingsOpen(true);
    // release the lock shortly after to avoid permanently blocking hammering calls
    setTimeout(() => { openLockRef.current = false; }, 500);
  };

  const closeSettings = () => {
    console.log('Closing settings...');
    setIsSettingsOpen(false);
  };

  return (
    <SettingsContext.Provider value={{ isSettingsOpen, openSettings, closeSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};