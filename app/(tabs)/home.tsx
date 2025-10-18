import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  BackHandler,
  Dimensions,
  Easing,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSettings } from '../../contexts/SettingsContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useUser } from '../../contexts/UserContext';

// Force all text to the app accent color regardless of theme
const TEXT_COLOR = '#4dccc1';

// Quick Stats Card Component
// import type { IoniconsGlyphs } from '@expo/vector-icons/build/Ionicons';

// add helper union for the animated prop
type ShadowFade = Animated.Value | Animated.AnimatedInterpolation<number>;

interface StatsCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  color?: string;
  // optional flag you referenced
  isNavigating?: boolean;
  // accept either the raw Animated.Value or an interpolated value
  shadowFade?: ShadowFade;
}

const StatsCard = ({ icon, value, label, color, shadowFade }: StatsCardProps) => {
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  // slightly muted light background
  const cardBg = isDarkMode ? 'rgba(14, 46, 44, 0.85)' : '#fcffffff';
  const outlineColor = '#4dccc1';

  const animatedShadowStyle = shadowFade
    ? {
        shadowOpacity: shadowFade.interpolate({ inputRange: [0, 1], outputRange: [0, 0.12] }) as any,
        elevation: shadowFade.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) as any,
      }
    : {};

  return (
    <Animated.View style={[styles.card, styles.statsCard, animatedShadowStyle, { backgroundColor: cardBg, borderWidth: 1, borderColor: outlineColor }]}>
      <Ionicons name={icon} size={24} color={color} />
      <Text style={[styles.statsValue, { color: TEXT_COLOR }]}>{value}</Text>
      <Text style={[styles.statsLabel, { color: TEXT_COLOR }]}>{label}</Text>
    </Animated.View>
  );
};

// Daily Check-in Component
type DailyCheckInProps = {
  hasCheckedIn: boolean;
  onCheckIn: () => void;
  isNavigating?: boolean;
  shadowFade?: ShadowFade;
};

const DailyCheckIn = ({ hasCheckedIn, onCheckIn, isNavigating, shadowFade }: DailyCheckInProps) => {
  const { t } = useTranslation();
  const buttonScale = React.useRef(new Animated.Value(1)).current;
  const checkInAnim = React.useRef(new Animated.Value(0)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const rotateAnim = React.useRef(new Animated.Value(0)).current;
  const checkmarkScale = React.useRef(new Animated.Value(0)).current;
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const cardBg = isDarkMode ? 'rgba(14, 46, 44, 0.85)' : '#fcffffff';
  const outlineColor = '#4dccc1';
  // check-in button text: white on light mode, dark on dark mode
  const checkInButtonTextColor = isDarkMode ? '#0A1E1C' : '#f7ffffff';

  const animatedShadowStyle = shadowFade
    ? {
        shadowOpacity: shadowFade.interpolate({ inputRange: [0, 1], outputRange: [0, 0.12] }) as any,
        elevation: shadowFade.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) as any,
      }
    : {};

  React.useEffect(() => {
    if (hasCheckedIn) {
      Animated.parallel([
        Animated.timing(checkInAnim, {
          toValue: 1,
          duration: 600,
          easing: Easing.bezier(0.2, 0.8, 0.2, 1),
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 400,
            easing: Easing.bezier(0.4, 0, 0.2, 1),
            useNativeDriver: true,
          }),
          Animated.spring(checkmarkScale, {
            toValue: 1,
            tension: 50,
            friction: 7,
            useNativeDriver: true,
          })
        ])
      ]).start();
    }
  }, [hasCheckedIn]);

  const handlePressIn = () => {
    Animated.spring(buttonScale, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(buttonScale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={[styles.card, styles.checkInCard, animatedShadowStyle, { backgroundColor: cardBg, borderWidth: 1, borderColor: outlineColor }]}> 
      <View style={styles.cardHeader}>
        <Ionicons name="checkmark-circle-outline" size={24} color="#98ECDB" />
        <Text style={[styles.cardTitle, { color: TEXT_COLOR }]}>{t('home.daily_checkin_title')}</Text>
      </View>
      {!hasCheckedIn ? (
        <View style={styles.checkInContent}>
          <Text style={[styles.checkInText, { color: TEXT_COLOR }]}>{t('home.checkin_prompt')}</Text>
          <TouchableOpacity
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={onCheckIn}
            activeOpacity={1}
          >
            <Animated.View style={[
              styles.checkInButton,
              { transform: [{ scale: buttonScale }], borderWidth: 1, borderColor: outlineColor }
            ]}>
              <Text style={[styles.checkInButtonText, { color: checkInButtonTextColor }]}>{t('home.check_in_now')}</Text>
            </Animated.View>
          </TouchableOpacity>
        </View>
      ) : (
        <Animated.View style={[
          styles.checkedInContent,
          {
            opacity: fadeAnim,
            transform: [{
              translateY: checkInAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0]
              })
            }]
          }
        ]}>
          <Animated.View style={[
            styles.checkedInIcon,
            {
              transform: [
                {
                  rotate: rotateAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['-45deg', '0deg']
                  })
                },
                { scale: fadeAnim }
              ]
            }
          ]}>
            <Animated.View style={{
              transform: [{ scale: checkmarkScale }]
            }}>
              <Ionicons name="checkmark" size={32} color="rgba(255, 255, 255, 0.9)" />
            </Animated.View>
          </Animated.View>
          <Text style={[styles.checkedInTitle, { color: TEXT_COLOR }]}>{t('home.great_job')}</Text>
          <Text style={[styles.checkedInText, { color: TEXT_COLOR }]}> 
            {t('home.checked_in_message')}
          </Text>
          <Animated.View style={[
            styles.badge,
            {
              opacity: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 1]
              }),
              transform: [{
                scale: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 1]
                })
              }]
            }
          ]}>
            <Text style={[styles.badgeText, { color: TEXT_COLOR }]}>{t('home.streak_maintained')}</Text>
          </Animated.View>
        </Animated.View>
      )}
    </Animated.View>
  );
};

export default function HomeScreen() {
  const { isSettingsOpen } = useSettings();
  const { userProfile, fetchUserProfile, loading, triggerStreak } = useUser();
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  // muted light background to reduce brightness
  // Slightly darker page/content background in light mode so cards (which remain #ffffffff)
  // visually pop against the surrounding area and header.
  const pageBg = isDarkMode ? '#0A1E1C' : '#ffffffff';
  const contentBg = isDarkMode ? '#0A1E1C' : '#ffffffff';
  const progressBg = isDarkMode ? '#0A1E1C' : '#ffffffff';
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [loadingCheckin, setLoadingCheckin] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  // Animation values for different elements (slide-in from right)
  const { width: windowWidth } = Dimensions.get('window');
  const slideAnim = React.useRef(new Animated.Value(windowWidth)).current;
  // shadow fade value tied to entrance animation so shadows appear in sync
  const shadowFade = React.useRef(new Animated.Value(0)).current;
  // Prevent replaying the entrance animation while the component remains mounted
  const hasRunEntranceRef = React.useRef(false);

  // Fetch user profile when component mounts or settings modal closes
  React.useEffect(() => {
    // rely on UserContext to fetch full profile (including streaks) once at launch
    fetchUserProfile();
  }, [fetchUserProfile, isSettingsOpen]);

  // Keep local streak state in sync with the shared userProfile loaded at launch
  React.useEffect(() => {
    if (!userProfile) return;
    setCurrentStreak(userProfile.currentStreak ?? 0);
    setLongestStreak(userProfile.longestStreak ?? 0);

    // Compute 'today' in Brasilia timezone so the UI resets at the intended local midnight
    const brasiliaToday = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    if (userProfile.lastCheckinDate && userProfile.lastCheckinDate === brasiliaToday) {
      setHasCheckedIn(true);
    } else {
      setHasCheckedIn(false);
    }
  }, [userProfile]);

  // Run entrance animations when component mounts. Guard so animations don't replay
  // if the Home screen is already mounted and receives a navigation action.
  React.useEffect(() => {
    if (hasRunEntranceRef.current) {
      // we're already mounted and have run the entrance animation; ensure
      // any navigation-aware state is cleared and skip replay.
      setIsNavigating(false);
      return;
    }

    hasRunEntranceRef.current = true;
    // Slide the page in from the right quickly.
    setIsNavigating(true);
    // animate slide and shadow in parallel; shadowFade uses JS driver so it can animate shadowOpacity
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(shadowFade, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      })
    ]).start(() => {
      // end navigation phase so any other animation-aware logic can resume
      setIsNavigating(false);
    });

    // Handle back button press to exit app
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      BackHandler.exitApp();
      return true;
    });

    return () => backHandler.remove();
  }, []);

    const handleCheckIn = async () => {
      if (loadingCheckin) return;
      setLoadingCheckin(true);
      try {
        // Centralized server-side RPC handles Brasilia timezone logic and gating per day.
        await triggerStreak();
        // Optimistically update UI; fetchUserProfile will refresh exact values.
        setHasCheckedIn(true);
        await fetchUserProfile();
      } catch (e) {
        console.error('Error performing check-in:', e);
      } finally {
        setLoadingCheckin(false);
      }
  };

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await fetchUserProfile();
    setRefreshing(false);
  }, [fetchUserProfile]);

  const { openSettings } = useSettings();

  return (
    <View style={styles.container}>
      {/* Full-screen background filler so pageBg covers the entire screen
          without affecting layout. pointerEvents='none' keeps touches working. */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: pageBg }} />

      <ScrollView 
        // ensure content renders above the background filler
        style={[styles.content, { backgroundColor: contentBg, zIndex: 1 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#80E6D9"
            colors={["#80E6D9"]}
            progressBackgroundColor={progressBg}
          />
        }>
        <Animated.View style={{ transform: [{ translateX: slideAnim }] }}>
          <View style={styles.statsGrid}>
          <StatsCard
            icon="calendar"
            value={currentStreak.toString()}
            label={t('home.day_streak')}
            color="#00dfc1ff"
            isNavigating={isNavigating}
            shadowFade={shadowFade}
           />
          <StatsCard
            icon="phone-portrait"
            value="2.4h"
            label={t('home.screen_time')}
            color="#00dfc1ff"
            isNavigating={isNavigating}
            shadowFade={shadowFade}
           />
          <StatsCard
            icon="trophy"
            value="85%"
            label={t('home.goals_met')}
            color="#00dfc1ff"
            isNavigating={isNavigating}
            shadowFade={shadowFade}
           />
          <StatsCard
            icon="people"
            value={userProfile?.partnerName || t('home.no_partner')}
            label={t('home.partner')}
            color="#00dfc1ff"
            isNavigating={isNavigating}
            shadowFade={shadowFade}
           />
        </View>
          <DailyCheckIn hasCheckedIn={hasCheckedIn} onCheckIn={handleCheckIn} isNavigating={isNavigating} shadowFade={shadowFade} />
          {/* Signup redirect removed per request */}
        </Animated.View>
      </ScrollView>
      {/** SettingsModal is now mounted globally in AppLayout */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    flex: 1,
    padding: 16,
    // background is controlled by the full-screen filler (pageBg).
    backgroundColor: 'transparent',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  card: {
    // default should be transparent; individual components set their own cardBg
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    // subtle shadow to lift cards (restored). We will toggle during navigation.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    // more subtle shadow for nodes
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 1,
  },
  cardNoShadow: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  statsCard: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 12,
  },
  statsValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginVertical: 4,
    color: TEXT_COLOR,
  },
  statsLabel: {
    fontSize: 12,
    color: TEXT_COLOR,
  },
  checkInCard: {
    marginBottom: 16,
    paddingVertical: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
    color: TEXT_COLOR,
  },
  checkInContent: {
    alignItems: 'center',
    paddingHorizontal: 16,
    width: '100%',
  },
  checkInText: {
    color: TEXT_COLOR,
    marginBottom: 24,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  checkInButton: {
    backgroundColor: '#4DCCC1',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
    // subtle accent shadow
    shadowColor: '#4dccc1',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
    marginTop: 8,
  },
  checkInButtonText: {
    color: TEXT_COLOR,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  checkedInContent: {
    alignItems: 'center',
    paddingHorizontal: 20,
    width: '100%',
  },
  checkedInIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#00704dff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  checkedInTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: TEXT_COLOR,
    marginBottom: 12,
  },
  checkedInText: {
    color: TEXT_COLOR,
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 16,
    lineHeight: 24,
    paddingHorizontal: 8,
  },
  badge: {
    backgroundColor: 'rgba(77, 205, 194, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(77, 205, 194, 0.1)',
    marginTop: 8,
  },
  badgeText: {
    color: TEXT_COLOR,
    fontSize: 14,
    fontWeight: '500',
  },
  signupRedirect: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  signupText: {
    color: TEXT_COLOR,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});