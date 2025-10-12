import { Ionicons } from '@expo/vector-icons';
import { router, useNavigation } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Animated, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import SettingsHeader from '../../components/settingsheader';
import { useSettings } from '../../contexts/SettingsContext';
import { useTheme } from '../../contexts/ThemeContext';
import supabase from '../../lib/supabase';

const GeneralSettings = () => {
  const { theme, toggleTheme } = useTheme();
  const isDarkMode = theme === 'dark';
  // Adjustable horizontal padding for the page body (header remains full-width)
  // Change this value to tweak spacing for the body area only.
  const CONTENT_H_PADDING = 20;
  const { t, i18n } = useTranslation();
  const navigation = useNavigation();
  const { closeSettings } = useSettings();

  // Theme-aware colors for pill buttons and disabled save state
  const pillBackground = isDarkMode ? '#0E2E2C' : '#FFFFFF';
  const pillBorderColor = '#4dccc1';
  const saveDisabledBg = isDarkMode ? '#23403d' : '#cccccc';
  const saveDisabledTextColor = isDarkMode ? '#7ea99f' : '#999999';

  // Local pending theme state — the switch updates this instead of applying theme immediately
  const [pendingDarkMode, setPendingDarkMode] = useState(isDarkMode);
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
  const dropdownAnim = useRef(new Animated.Value(0)).current;
  
  // Rotate arrow and fade language label
  const languageLabelAnim = useRef(new Animated.Value(1)).current;
  const arrowRotate = dropdownAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  
  // Theme icon animation (0 = light/sun, 1 = dark/moon)
  const themeIconAnim = useRef(new Animated.Value(pendingDarkMode ? 1 : 0)).current;

  // Track initial and current values
  const initialValuesRef = useRef({ theme, language: i18n.language });
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Animated value to smoothly transition Save button background when enabled/disabled
  const saveAnim = useRef(new Animated.Value((hasChanges && !isSaving) ? 1 : 0)).current;
  const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

  const toggleLanguageDropdown = () => {
    if (!isLanguageDropdownOpen) {
      // Open immediately so the dropdown mounts, then animate
      setIsLanguageDropdownOpen(true);
      Animated.timing(dropdownAnim, {
        toValue: 1,
        duration: 195,
        useNativeDriver: true,
      }).start();
    } else {
      // Closing: rotate arrow & fade label slightly for smoothness
      Animated.parallel([
        Animated.timing(languageLabelAnim, { toValue: 0.85, duration: 143, useNativeDriver: true }),
        Animated.timing(dropdownAnim, { toValue: 0, duration: 195, useNativeDriver: true }),
      ]).start(() => {
        setIsLanguageDropdownOpen(false);
        // Restore label opacity
        Animated.timing(languageLabelAnim, { toValue: 1, duration: 156, useNativeDriver: true }).start();
      });
    }
  };

  // Hardcoded language order and display names
  const languages = [
    { code: 'pt-BR', name: 'Português', dropdownName: 'Português (Brasileiro)' },
    { code: 'es', name: 'Español', dropdownName: 'Español' },
    { code: 'en', name: 'English', dropdownName: 'English' },
  ];
  
  // PendingLanguage holds the selection until Save is pressed
  const [pendingLanguage, setPendingLanguage] = useState(i18n.language);

  const handleLanguageChange = (languageCode: string) => {
    // Cross-fade the label, then close dropdown with rotation, then set pending language and fade label back in
  Animated.timing(languageLabelAnim, { toValue: 0, duration: 156, useNativeDriver: true }).start(() => {
      Animated.timing(dropdownAnim, { toValue: 0, duration: 195, useNativeDriver: true }).start(() => {
        setIsLanguageDropdownOpen(false);
        setPendingLanguage(languageCode);
        Animated.timing(languageLabelAnim, { toValue: 1, duration: 208, useNativeDriver: true }).start();
      });
    });
  };

  const checkForChanges = (currentTheme: string, currentLanguage: string) => {
    const iv = initialValuesRef.current;
  setHasChanges(
      currentTheme !== iv.theme ||
      currentLanguage !== iv.language
    );
  };

  // Recompute hasChanges when pending selections change
  useEffect(() => {
    checkForChanges(pendingDarkMode ? 'dark' : 'light', pendingLanguage);
  }, [pendingDarkMode, pendingLanguage]);

  useEffect(() => {
    setPendingDarkMode(isDarkMode);
  }, [isDarkMode]);

  // Animate theme icon when pendingDarkMode changes
  useEffect(() => {
    Animated.timing(themeIconAnim, { toValue: pendingDarkMode ? 1 : 0, duration: 260, useNativeDriver: true }).start();
  }, [pendingDarkMode]);

  // Animate the Save button background color smoothly when enabled/disabled
  useEffect(() => {
    const toValue = (hasChanges && !isSaving) ? 1 : 0;
    Animated.timing(saveAnim, { toValue, duration: 260, useNativeDriver: false }).start();
  }, [hasChanges, isSaving, isDarkMode]);

  const handleSave = async () => {
    if (!hasChanges || isSaving) return;
    // Show saving state
    setIsSaving(true);
    setHasChanges(false);

    try {
      // Persist settings to the user's profile in the database first
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const uid = user.id;
        const { error: updateErr } = await supabase
          .from('profiles')
          .update({ 
            applanguage: pendingLanguage, 
            apptheme: (pendingDarkMode ? 'dark' : 'light') 
          })
          .eq('id', uid);
        if (updateErr) {
          console.warn('Failed to persist settings to profile:', updateErr);
        }
      }
    } catch (dbErr) {
      console.error('Error saving settings to DB:', dbErr);
    }

    // Wait 425ms to show loading UI, then navigate to splash
    setTimeout(() => {
      // Close settings modal immediately so it doesn't stay open on top of splash
      try { 
        closeSettings(); 
      } catch (e) { 
        // No-op if context unavailable
      }
  router.push('/(tabs)');

      // Apply saved changes after navigation so the app updates on the splash route
      // Small additional delay gives the router time to mount the splash screen
      setTimeout(() => {
        // Apply theme change if needed
        if ((pendingDarkMode ? 'dark' : 'light') !== theme) {
          toggleTheme();
        }
        // Apply language change if needed
        if (pendingLanguage !== i18n.language) {
          i18n.changeLanguage(pendingLanguage);
        }
        // Update saved baseline so future changes are detected correctly
        initialValuesRef.current = { 
          theme: (pendingDarkMode ? 'dark' : 'light'), 
          language: pendingLanguage 
        };
        setIsSaving(false);
      }, 200);
    }, 425);
  };

  const getThemeText = () => {
    const themeLabel = t('settings.theme');
    const themeValue = pendingDarkMode ? t('settings.theme_value_dark') : t('settings.theme_value_light');
    return `${themeLabel}: ${themeValue}`;
  };

  const getCurrentLanguageName = () => {
    const language = languages.find(lang => lang.code === pendingLanguage);
    return language?.name || t('settings.language');
  };

  const getLanguageDropdownName = (language: { dropdownName?: string; name: string }) => {
    return language.dropdownName || language.name;
  };

  return (
  <View style={[styles.container, { flex: 1, backgroundColor: isDarkMode ? '#07201d' : '#F7FFFC' }]}> 
  <SettingsHeader title={t('settings.title') || 'Settings'} onLeftPress={() => router.back()} onRightPress={() => { try { closeSettings(); } catch (e) { router.back(); } }} />

  {/* Page body with adjustable horizontal padding (header stays full-width) */}
  <View style={{ flex: 1, paddingHorizontal: CONTENT_H_PADDING }}>

  {/* Theme Switch */}
  <View style={[
        styles.settingItem, 
        { backgroundColor: pillBackground, borderColor: pillBorderColor }, 
        styles.firstItem
      ]}>
        <View style={styles.settingLeft}>
          {/* Animated theme icon: cross-fade + slight rotation between sun and moon */}
          <View style={{ width: 24, height: 24, marginRight: 12 }}>
            <Animated.View style={{
              position: 'absolute',
              opacity: themeIconAnim,
              transform: [{ rotate: themeIconAnim.interpolate({ 
                inputRange: [0, 1], 
                outputRange: ['0deg', '30deg'] 
              }) }]
            }}>
              <Ionicons name="moon" size={24} color="#4dccc1" />
            </Animated.View>
            <Animated.View style={{
              position: 'absolute',
              opacity: themeIconAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
              transform: [{ rotate: themeIconAnim.interpolate({ 
                inputRange: [0, 1], 
                outputRange: ['0deg', '-30deg'] 
              }) }]
            }}>
              <Ionicons name="sunny" size={24} color="#4dccc1" />
            </Animated.View>
          </View>
          <Text style={styles.settingText}>{getThemeText()}</Text>
        </View>
        <Switch
          value={pendingDarkMode}
          onValueChange={setPendingDarkMode}
          trackColor={{ false: '#cfcfcf', true: '#4dccc1' }}
          ios_backgroundColor="#cfcfcf"
          thumbColor="#ffffff"
        />
      </View>

      {/* Language Selector */}
      <View style={styles.languageContainer}>
        <TouchableOpacity 
          style={[styles.settingItem, { backgroundColor: pillBackground, borderColor: pillBorderColor }]} 
          onPress={toggleLanguageDropdown}
        >
          <View style={styles.settingLeft}>
            <Ionicons 
              name="language" 
              size={24} 
              color="#4dccc1" 
              style={styles.icon}
            />
            <Text style={styles.settingText}>{t('settings.language')}</Text>
          </View>
          <View style={styles.languageSelector}>
            <Animated.Text style={[styles.currentLanguage, { 
              opacity: languageLabelAnim, 
              transform: [{ translateY: languageLabelAnim.interpolate({ 
                inputRange: [0, 1], 
                outputRange: [2, 0] 
              }) }] 
            }]}> 
              {getCurrentLanguageName()}
            </Animated.Text>
            <Animated.View style={{ transform: [{ rotate: arrowRotate }], marginLeft: 6 }}>
              <Ionicons name="chevron-down" size={24} color="#4dccc1" />
            </Animated.View>
           </View>
         </TouchableOpacity>
 
         {/* Language Dropdown */}
         {isLanguageDropdownOpen && (
           <Animated.View
             style={[
               styles.dropdown,
               {
                 opacity: dropdownAnim,
                 transform: [{ 
                   translateY: dropdownAnim.interpolate({
                     inputRange: [0, 1],
                     outputRange: [-10, 0]
                   })
                 }],
                 backgroundColor: isDarkMode ? '#0E2E2C' : '#ffffff',
                 borderTopColor: '#4dccc1',
                 borderColor: '#4dccc1',
               }
             ]}
           >
             {languages.map((language, index) => {
               const selectedBg = isDarkMode ? 'rgba(77,204,193,0.20)' : 'rgba(77,204,193,0.16)';
               const isLast = index === languages.length - 1;
               return (
                 <TouchableOpacity
                   key={language.code}
                   style={[
                     styles.dropdownItem,
                     isLast && { borderBottomWidth: 0 },
                     language.code === pendingLanguage && { backgroundColor: selectedBg }
                   ]}
                   onPress={() => handleLanguageChange(language.code)}
                 >
                   <Text style={[
                     styles.dropdownText,
                     { fontWeight: '700', color: '#4dccc1' }
                   ]}>
                     {getLanguageDropdownName(language)}
                   </Text>
                 </TouchableOpacity>
               );
             })}
           </Animated.View>
         )}
       </View>

       {/* Manage Modules */}
      <TouchableOpacity 
        style={[styles.settingItem, { backgroundColor: pillBackground, borderColor: pillBorderColor }]}
        onPress={() => {
          try { (router as any).push('/(tabs)/ign-ModuleManager'); } catch (err) { /* ignore navigation errors */ }
        }}
      >
         <View style={styles.settingLeft}>
           <Ionicons 
             name="grid" 
             size={24} 
             color="#4dccc1" 
             style={styles.icon}
           />
           <Text style={styles.settingText}>{t('settings.manage_modules')}</Text>
         </View>
         <Ionicons 
           name="chevron-forward" 
           size={24} 
           color="#4dccc1" 
         />
       </TouchableOpacity>

       {/* Save Button */}
  {(() => {
        const disabled = !hasChanges || isSaving;
        // animated background color (disabled -> active) with distinct light/dark values
        const saveActiveBg = isDarkMode ? 'rgba(77,204,193,0.12)' : 'rgba(77,204,193,0.12)';
        const saveDisabledBgTrans = isDarkMode ? 'rgba(35,64,61,0.12)' : 'rgba(204,204,204,0.12)';
        const bgColor = saveAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [saveDisabledBgTrans, saveActiveBg]
        });
        const textColor = saveAnim.interpolate({ inputRange: [0, 1], outputRange: [saveDisabledTextColor, '#4DCCC1'] });

        return (
          <AnimatedTouchable
            activeOpacity={disabled ? 1 : 0.85}
            style={[
              styles.saveButton,
              {
                backgroundColor: bgColor,
                borderWidth: 0.7,
                opacity: disabled ? 0.6 : (isSaving ? 0.9 : 1),
              },
              disabled ? { borderColor: '#9CCFC8' } : { borderColor: '#4DCCC1' }
            ]}
            onPress={handleSave}
            disabled={disabled}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#4DCDC2" />
            ) : (
              <Animated.Text style={[styles.saveButtonText, { color: textColor }]}>
                {t('settings.save_changes')}
              </Animated.Text>
            )}
          </AnimatedTouchable>
        );
      })()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // 8 default + 20 requested = 28
    paddingTop: 28,
    paddingHorizontal: 16,
  },
  languageContainer: {
    position: 'relative',
    zIndex: 1,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    borderRadius: 28,
    padding: 0,
    paddingHorizontal: 16,
    marginVertical: 4,
    borderWidth: 1,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 12,
  },
  settingText: {
    fontSize: 16,
    color: '#4dccc1',
  },
  languageSelector: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentLanguage: {
    fontSize: 16,
    color: '#4dccc1',
    marginRight: 8,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderColor: '#4dccc1',
    borderWidth: 1,
    borderTopWidth: 1,
    marginTop: -1,
    overflow: 'hidden',
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#4dccc1',
    borderRadius: 0,
  },
  dropdownText: {
    fontSize: 16,
    color: '#E0F7F4',
  },
  firstItem: {
    marginTop: 0,
  },
  saveButton: {
    backgroundColor: 'transparent',
    height: 50,
    width: '100%',
    paddingHorizontal: 12,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
    borderWidth: 0.7,
    borderColor: '#4dccc1',
  },
  saveButtonText: {
    color: '#4DCCC1',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonTextDisabled: {
    color: '#9CCFC8',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingTop: 27,
  },
  iconTouch: {
    padding: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4dccc1',
    textAlign: 'center',
    flex: 1,
  },
});

export default GeneralSettings;