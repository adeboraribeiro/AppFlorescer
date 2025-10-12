import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

// Pill metrics (kept inline to avoid external files)
const PILL_HEIGHT = 56;
const PILL_RADIUS = 28;
const PILL_H_PADDING = 16;
const PILL_ICON_SIZE = 24;
const PILL_FONT_SIZE = 16;
const PILL_MARGIN = 4;

type Props = {
  title?: string;
  subtitle?: string;
  leftIcon?: string; // Ionicons name
  rightIcon?: string | null; // Ionicons name or null to hide
  onLeftPress?: () => void;
  onRightPress?: () => void;
  gradient?: boolean;
  /** if true, slightly taller header with extra top padding for status bar */
  large?: boolean;
};

export default function SettingsHeader({
  title,
  subtitle,
  leftIcon = 'chevron-back',
  rightIcon = 'close',
  onLeftPress,
  onRightPress,
  gradient = false,
  large = true,
}: Props) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const handleLeft = () => {
    if (onLeftPress) return onLeftPress();
    try { router.back(); } catch (e) { /* ignore */ }
  };

  const handleRight = () => {
    if (onRightPress) return onRightPress();
    try { router.back(); } catch (e) { /* ignore */ }
  };

  // The header is intentionally fixed-size. large prop is accepted for API
  // compatibility but does not change layout. The outer container has a fixed
  // height and the pill is vertically centered so the header appears identical
  // across pages.
  const headerContent = (
    <View style={styles.row}>
      <View style={styles.pill}>
        <TouchableOpacity onPress={handleLeft} style={styles.iconTouch} accessibilityRole="button">
          <Ionicons name={leftIcon as any} size={PILL_ICON_SIZE as any} color="#4dccc1" />
        </TouchableOpacity>

        <View style={styles.titleWrap}>
          {title ? <Text numberOfLines={1} style={[styles.titleText, { color: '#4dccc1' }]}>{title}</Text> : null}
          {subtitle ? <Text numberOfLines={1} style={[styles.subText, { color: isDark ? '#a0a0a0' : '#666' }]}>{subtitle}</Text> : null}
        </View>

  {/* right action removed per design: keep header minimal */}
  <View style={{ width: PILL_ICON_SIZE }} />
      </View>
    </View>
  );

  // Keep the outer container visually transparent by default so only the pill is visible.
  // If gradient is explicitly requested, use a very subtle transparent gradient to avoid any solid stripe.
  if (gradient) {
    const topColor = isDark ? 'rgba(10,30,28,0)' : 'rgba(247,255,252,0)';
    const bottomColor = isDark ? 'rgba(10,30,28,0)' : 'rgba(247,255,252,0)';
    return (
      <LinearGradient colors={[topColor, bottomColor]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.container}>
        {headerContent}
      </LinearGradient>
    );
  }

  return <View style={[styles.container, { backgroundColor: 'transparent' }]}>{headerContent}</View>;
}

const styles = StyleSheet.create({
  // Fixed outer header height so the header never adapts its size.
  container: {
    width: '100%',
    height: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    paddingHorizontal: 8,
  },
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // largePadding intentionally unused to keep size consistent
  largePadding: {},
  iconTouch: {
    padding: 8,
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    flex: 1,
    height: PILL_HEIGHT,
    borderRadius: PILL_RADIUS,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PILL_H_PADDING,
    // no border or background — header should be minimal
    backgroundColor: 'transparent',
    borderWidth: 0,
    marginVertical: 0,
  },
  titleWrap: {
  // Make the title span the full width of the screen and center it there
  position: 'absolute',
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
  alignItems: 'center',
  justifyContent: 'center',
  paddingHorizontal: 6,
  },
  titleText: {
  fontSize: PILL_FONT_SIZE,
  // stronger weight for a bolder look
  fontWeight: '800',
  },
  subText: {
    fontSize: 14,
    marginTop: 2,
  },
});
