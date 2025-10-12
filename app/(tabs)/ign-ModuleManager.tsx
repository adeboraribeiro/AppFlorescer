import { router } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';
import { ManageModules } from '../(tabs)/_layout';
import SettingsHeader from '../../components/settingsheader';
import { useSettings } from '../../contexts/SettingsContext';
import { useTheme } from '../../contexts/ThemeContext';

export default function ModuleManagerPage() {
  const { t } = useTranslation();
  const { closeSettings } = useSettings();
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  // Page background so the header and content match GeneralSettings
  const pageBg = isDarkMode ? '#07201d' : '#F7FFFC';

  // Swipe removed: Module Manager is static now. All gesture code has been deleted.
  // Reintroduce a lightweight vertical FreeSwipeView locally so this page
  // supports free vertical swiping without relying on the removed component.
  function FreeSwipeView({
    children,
    handleWidth = 28,
    handleColor = isDarkMode ? '#98ECDB' : '#4dccc1',
    maxUp = 240,
    onDismiss,
  }: {
    children: React.ReactNode;
    handleWidth?: number;
    handleColor?: string;
    maxUp?: number;
    onDismiss?: () => void;
  }) {
  const translateY = React.useRef(new Animated.Value(0)).current;
  const lastDy = React.useRef(0);
  // Disable downward dragging: clamp between -maxUp (up) and 0 (no down)
  const maxDown = 0;

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  const panResponder = React.useRef(
      PanResponder.create({
  onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_evt, gestureState) => Math.abs(gestureState.dy) > 4,
        onPanResponderGrant: () => {
          // nothing special here — we'll compute position manually to avoid
          // Animated offsets which complicate keeping final position
        },
        onPanResponderMove: (_evt, gestureState) => {
          // allow only upward movement (negative dy). No downward movement allowed.
          const current = clamp(lastDy.current + gestureState.dy, -Math.abs(maxUp), 0);
          translateY.setValue(current);
        },
        onPanResponderRelease: (_evt, gestureState) => {
          // Calculate final absolute position and keep it (no bounce). No downward releases.
          const final = clamp(lastDy.current + gestureState.dy, -Math.abs(maxUp), 0);
          // If user swiped up past threshold, treat as dismiss
          if (final <= -Math.abs(maxUp)) {
            // animate to the dismiss position with a subtle spring then call onDismiss
            Animated.spring(translateY, { toValue: -Math.abs(maxUp), friction: 8, tension: 40, useNativeDriver: true }).start(() => {
              if (onDismiss) onDismiss();
            });
            lastDy.current = -Math.abs(maxUp);
            return;
          }

          // Otherwise, animate to the release position with a small spring for slight bounce
          Animated.spring(translateY, { toValue: final, friction: 9, tension: 45, useNativeDriver: true }).start(() => {
            lastDy.current = final;
          });
        },
        onPanResponderTerminate: () => {
          translateY.flattenOffset();
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
        },
      })
    ).current;

    return (
      <Animated.View style={[{ flex: 1, transform: [{ translateY }] }]} {...panResponder.panHandlers}>
        <View style={{ flex: 1 }} pointerEvents="box-none">
          {children}
        </View>
      </Animated.View>
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: pageBg }]}
    > 
      {/* Render the canonical ManageModules UI from the tabs layout as a full page (no scrolling here)
          SettingsHeader moved inside the swipe wrapper so it moves together with the content */}
      <View style={[styles.scrollContent, { flex: 1 }]}> 
        <FreeSwipeView handleWidth={28} handleColor={isDarkMode ? '#98ECDB' : '#4dccc1'} onDismiss={() => { try { closeSettings(); } catch (e) { router.back(); } }}>
          <SettingsHeader title={t('settings.manage_modules') || 'Manage Modules'} onLeftPress={() => router.back()} onRightPress={() => { try { closeSettings(); } catch (e) { router.back(); } }} />
          <ManageModules onClose={() => router.back()} />
        </FreeSwipeView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    // 8 default + 20 requested = 28
    paddingTop: 28, 
    paddingHorizontal: 16 
  },
  scrollContent: { 
    paddingHorizontal: 0, 
    paddingBottom: 48 
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: -8,
    paddingTop: 27,
  },
  iconTouch: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4dccc1',
    textAlign: 'center',
    flex: 1,
  },
});