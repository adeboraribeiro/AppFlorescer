import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Dimensions, Image, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettings } from '../contexts/SettingsContext';
import useNetworkState from './useNetworkState';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import { Icons } from './ui/Icons';

const Header = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  // Use a clearly defined theme-aware background for the rounded header
  // (bgColor). To avoid the dark page showing through curved edges we set
  // the SafeAreaView background to match the page background (safeBg)
  // and render an inner rounded container with bgColor that holds content.
  // Use standard 6-digit white for light mode so it exactly matches the
  // app background; also make the safe area filler white.
  const bgColor = isDarkMode ? '#0e2e2c' : '#ffffffff';
  const borderAccent = isDarkMode ? '#80E6D9' : '#4dccc1';
  const iconColor = isDarkMode ? '#80E6D9' : '#4dccc1';
  const textColor = isDarkMode ? '#4dccc1' : '#4dccc1';
  const [greeting, setGreeting] = useState('');
  const { userProfile } = useUser();
  const { isOffline } = useNetworkState();
  const { openSettings } = useSettings();
  // prevent double-clicks: only allow opening once per 300ms
  const lastOpenRef = useRef<number>(0);

  const openSettingsThrottled = () => {
    const now = Date.now();
    if (now - lastOpenRef.current < 300) return;
    lastOpenRef.current = now;
    // If context-level guard already prevents open, this will return early.
    openSettings();
  };

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) {
      setGreeting(t('header.good_morning'));
    } else if (hour < 18) {
      setGreeting(t('header.good_afternoon'));
    } else {
      setGreeting(t('header.good_evening'));
    }
    // re-run when language changes via i18n
  }, [t]);

  const insets = useSafeAreaInsets();
  // Animated value to drive color transitions between offline (0) and online (1)
  const colorAnim = useRef(new Animated.Value(isOffline ? 0 : 1)).current;

  useEffect(() => {
    Animated.timing(colorAnim, {
      toValue: isOffline ? 0 : 1,
      duration: 320,
      useNativeDriver: false, // color interpolation isn't supported on native driver
    }).start();
  }, [isOffline, colorAnim]);

  const borderColorInter = colorAnim.interpolate({ inputRange: [0, 1], outputRange: ['#9CA3AF', borderAccent] });
  const imageBgInter = colorAnim.interpolate({ inputRange: [0, 1], outputRange: ['#9CA3AF', borderAccent] });
  const dotColorInter = colorAnim.interpolate({ inputRange: [0, 1], outputRange: ['#9CA3AF', '#4DCDC2'] });
  const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);
  // approximate content height (icon + vertical padding). We add the status bar inset
  // so the filler covers exactly the same vertical area as the header.
  const headerContentHeight = 56; // adjust if header actual height changes
  const { height: windowHeight } = Dimensions.get('window');
  const extraDown = Math.round(windowHeight * 0.2); // extend filler down by 20% of screen height
  const fillerHeight = insets.top + headerContentHeight + extraDown;

  return (
    <View style={{ position: 'relative' }}>
      <SafeAreaView style={[styles.header, { backgroundColor: bgColor, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, zIndex: 1 }]}>
        <StatusBar backgroundColor={bgColor} barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <View style={styles.content}>
          {/* Animated avatar container so borderColor can transition */}
          <AnimatedTouchable
            style={[styles.iconContainer, { borderColor: borderColorInter as any }]}
            onPress={() => router.push('/(tabs)/ign-account' as any)}
          >
            {userProfile?.profileImage ? (
              <View>
        {/* Animated.Image to allow animated backgroundColor */}
        <Animated.Image source={{ uri: userProfile.profileImage }} style={[styles.profileImage, { backgroundColor: imageBgInter as any }]} />
        <Animated.View style={[styles.networkDot, { backgroundColor: dotColorInter as any }]} />
              </View>
            ) : (
              <View>
                <Icons.person size={42} color={iconColor} />
        <Animated.View style={[styles.networkDot, { backgroundColor: dotColorInter as any }]} />
              </View>
            )}
      </AnimatedTouchable>
          <Text style={[styles.greeting, { color: textColor }]} numberOfLines={1} ellipsizeMode="tail">
            {greeting}, {userProfile?.firstName || 'User'}!
          </Text>
          <View style={styles.bellButton}>
            <Icons.bell size={28} color={iconColor} />
          </View>
          <TouchableOpacity onPress={openSettingsThrottled} style={styles.settingsButton}>
            <Icons.settings size={32} color={iconColor} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    // Ensure header masks rounded corners and sits above content.
    paddingTop: '7%',
    // Allow shadow to render by keeping overflow visible
    overflow: 'visible',
    position: 'relative',
    zIndex: 10,
    // Subtle drop shadow to lift the header above page content
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 10,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  iconContainer: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 23,
    borderWidth: 2,
    // borderColor: '#80E6D9',
  },
  greeting: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    // color: '#E0F7F4',
    marginLeft: 10,
    textAlign: 'left',
  },
  settingsButton: {
    width: 44,
    alignItems: 'center',
  },
  bellButton: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  profileImage: {
    width: 42,
    height: 42,
    borderRadius: 21,
    // backgroundColor: '#80E6D9',
  },
  networkDot: {
    position: 'absolute',
    right: -2,
    top: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#0A1E1C', // dark border so dot is visible over light/dark
  },
  dotOnline: {
    backgroundColor: '#4DCDC2',
  },
  dotOffline: {
    backgroundColor: '#9CA3AF',
  },
});

export default Header;
