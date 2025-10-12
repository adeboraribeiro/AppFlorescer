import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BackHandler,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useSettings } from '../contexts/SettingsContext';
import { useTheme } from '../contexts/ThemeContext';

// Memoize the settings options outside component to prevent recreation
const SETTINGS_OPTIONS = [
  { id: 'Account', titleKey: 'settings.menu.account', icon: 'person-outline' as const },
  { id: 'Florescer+', titleKey: 'settings.menu.florescer_plus', icon: 'star-outline' as const },
  { id: 'General', titleKey: 'settings.menu.general', icon: 'options-outline' as const },
  { id: 'Help', titleKey: 'settings.menu.help', icon: 'help-circle-outline' as const },
];

const textColor = '#4dccc1';

function SettingsModal() {
  const { t } = useTranslation();
  const { isSettingsOpen, closeSettings } = useSettings();
  const { theme } = useTheme();
  
  const isDarkMode = theme === 'dark';
  
  const handleCloseSettings = useCallback(() => {
    closeSettings();
  }, [closeSettings]);

  const handleOptionPress = useCallback((id: string) => {
    closeSettings();
    
    if (id === 'Account') {
      router.push('/(tabs)/ign-account');
    } else if (id === 'General') {
      router.push('/(tabs)/ign-GeneralSettings');
    }
  }, [closeSettings]);

  // Handle Android hardware back: close settings modal when open
  useEffect(() => {
    if (!isSettingsOpen) return;

    const onBack = () => {
      handleCloseSettings();
      return true;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [isSettingsOpen, handleCloseSettings]);

  // Memoize computed styles
  const dynamicStyles = useMemo(() => {
    const modalBackground = isDarkMode ? '#0A1E1C' : '#FFFFFF';
    const nodeBackground = isDarkMode ? '#0A1E1C' : '#FFFFFF';
    
    return {
      backdrop: [StyleSheet.absoluteFill, { 
        backgroundColor: modalBackground, 
        opacity: isDarkMode ? 0.85 : 0.45 
      }],
      modalContainer: [
        styles.modalContainer, 
        { 
          backgroundColor: nodeBackground, 
          borderColor: isDarkMode ? '#4dccc194' : '#4dccc1' 
        }
      ],
      gridItem: [
        styles.gridItem, 
        { backgroundColor: nodeBackground }
      ],
    };
  }, [isDarkMode]);

  // Early return - don't render anything if not open
  if (!isSettingsOpen) return null;

  return (
    <Modal visible={isSettingsOpen} transparent animationType="fade" statusBarTranslucent>
      <View style={dynamicStyles.backdrop} />
      
      <View style={styles.container}>
        <View style={styles.modalCenter}>
          <Pressable style={styles.modalCenter} onPress={handleCloseSettings} />
          
          <View style={styles.overlayPress}>
            <View style={dynamicStyles.modalContainer}>
              <TouchableOpacity style={styles.closeButton} onPress={handleCloseSettings}>
                <Ionicons name="close" size={24} color={textColor} />
              </TouchableOpacity>

              <Text style={styles.title}>
                {t('settings.title')}
              </Text>

              <View style={styles.gridContainer}>
                {SETTINGS_OPTIONS.map((option) => (
                  <TouchableOpacity 
                    key={option.id} 
                    style={dynamicStyles.gridItem}
                    onPress={() => handleOptionPress(option.id)}
                  >
                    <Ionicons name={option.icon} size={22} color={textColor} style={styles.icon} />
                    <Text style={styles.optionText}>
                      {t(option.titleKey)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  modalCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  overlayPress: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  modalContainer: {
    width: 360,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    position: 'relative',
    alignSelf: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 24,
    textAlign: 'center',
    letterSpacing: 0.5,
    color: '#4dccc1',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginHorizontal: -8,
  },
  gridItem: {
    width: '46%',
    marginHorizontal: 6,
    marginVertical: 6,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4dccc1',
  },
  optionText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    opacity: 0.9,
    color: '#4dccc1',
  },
  icon: {
    marginBottom: 4,
    opacity: 0.9,
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    top: 16,
    padding: 8,
    borderRadius: 20,
    zIndex: 10,
  }
});

export default SettingsModal;