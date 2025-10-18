import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  InteractionManager,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import Svg, { Circle, G, Text as SvgText } from 'react-native-svg';
import { useAuth } from '../../contexts/AuthContext';
import { useUser } from '../../contexts/UserContext';
// plan export removed: exporter logic intentionally disabled to avoid bundling/auto-export
import Providers from '@/components/Providers';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { clearSelectedPlans, exportSelectedPlans } from '../../components/planexport';
import { useSafeUserData } from '../../components/SafeUserDataProvider';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../lib/supabase';

export default function Onboarding() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams();
  const fromParam = (params as any)?.from;
  const openedFromLogin = fromParam === 'login' || fromParam === 'LoginScreen';
  // Redirect guard: if an authenticated session exists, onboarding should not render.
  const { user: authUser, session: authSession, loading: authLoading } = useAuth();
  const { userProfile, loading: userLoading } = useUser();
  const safe = useSafeUserData();

  useEffect(() => {
    // Wait until auth/user loading settles. If a session or authenticated
    // user is present and the runtime profile is complete, send them straight
    // to the home route and do not render onboarding. If the profile is
    // incomplete, allow onboarding to render so the user can finish setup.
    if (authLoading || userLoading) return;
    if (authSession || authUser) {
      const profileComplete = !!(userProfile && userProfile.firstName && userProfile.birthDate && userProfile.username);
      if (profileComplete) {
        try {
          router.replace('/(tabs)/home' as any);
        } catch (e) {
          // ignore navigation errors
        }
      }
      // otherwise don't redirect — let the onboarding flow continue so the
      // user can complete their profile (avoids an infinite redirect loop).
    }
  }, [authLoading, userLoading, authSession, authUser, router]);

  // If onboarding is shown for an unauthenticated flow, ensure we nuke any
  // locally-stored credentials and passkeys as a best-effort security measure.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Only run if there is no active auth session/user
        if (authSession || authUser) return;
        // Best-effort: call provider helpers to delete local pfp, credentials, passkey and flo
        try {
          if (safe?.deleteLocalPfp) await safe.deleteLocalPfp();
        } catch (e) { /* ignore */ }
        try {
          if (safe?.deleteCredentialsFromSecureStore) await safe.deleteCredentialsFromSecureStore();
        } catch (e) { /* ignore */ }
        try {
          if (safe?.clearPasskey) await safe.clearPasskey();
        } catch (e) { /* ignore */ }
        try {
          if (safe?.deleteUserFlo) await safe.deleteUserFlo();
        } catch (e) { /* ignore */ }

        // Remove flo and pfp directories entirely (idempotent)
        try { await FileSystem.deleteAsync(`${FileSystem.documentDirectory}flo`, { idempotent: true }); } catch (e) { /* ignore */ }
        try { await FileSystem.deleteAsync(`${FileSystem.documentDirectory}pfp`, { idempotent: true }); } catch (e) { /* ignore */ }

        // Sign out server-side just in case (best-effort)
        try { await supabase.auth.signOut(); } catch (e) { /* ignore */ }
      } catch (e) {
        // ignore all errors — this is best-effort cleanup
      }
    })();
    return () => { mounted = false; };
  }, [authSession, authUser, safe]);
  // Termination guard: when onboarding was opened from the login screen we
  // may end up with duplicated work if the user navigates back-and-forth.
  // Schedule a short-lived termination after navigating to login to stop
  // animations/timers and render a lightweight placeholder to avoid lag.
  const terminationTimerRef = useRef<any>(null);
  const [terminated, setTerminated] = useState(false);
  // Support query params to control initial onboarding behavior. Examples:
  // - ?redirect=skip  => start at page 1 (skip welcome)
  // - ?start=1        => start at step 1
  // - ?from=login     => treat as coming from login and skip welcome
  const startParam = (params as any)?.redirect ?? (params as any)?.start ?? (params as any)?.from;
  const skipWelcome = startParam === 'skip' || startParam === '1' || startParam === 'page1' || startParam === 'LoginScreen';
  // Values used by the rest of the UI. These update at the midpoint of the
  // welcome fade so non-welcome screens change while welcome keeps its own state.
  const [displayLang, setDisplayLang] = useState(i18n.language);
  const [displayIsDark, setDisplayIsDark] = useState(theme === 'dark');
  const midpointTimerRef = useRef<any>(null);
  // Guard to detect initial mount so we don't schedule a deferred restart on first render
  const initialMountRef = useRef(true);
  
  // When language or theme changes, schedule a deferred restart to the welcome step.
  // Wait 1 second of no further changes before resetting visuals/state to the welcome screen.
  useEffect(() => {
    // Clear any existing scheduled restart
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (midpointTimerRef.current) {
      clearTimeout(midpointTimerRef.current);
      midpointTimerRef.current = null;
    }
    // Skip scheduling the deferred restart on the very first mount. This prevents
    // the welcome screen from appearing to 'reload' twice at app launch while
    // leaving the restart behavior intact for subsequent language/theme changes.
    if (initialMountRef.current) {
      initialMountRef.current = false;
      return;
    }
  restartTimerRef.current = setTimeout(() => {
      // Ensure welcome is positioned on-screen: set step to 0 and reset slide offset
      setStep(0);
  // Immediately set translation to 0 so the welcome column is visible
  slideAnim.setValue(0);
  // Start from invisible and fade in
  welcomeOpacityAnim.setValue(0);

      // Clear selection state synchronously so UI reflects the reset while fading
      setPrimary(null);
      setWellnessPath(null);
      setShowProductivityCard(false);
      // Reset all animated selection values immediately
  wellnessAnim.setValue(0);
  wellnessScaleAnim.setValue(1);
  productivityAnim.setValue(0);
  productivityScaleAnim.setValue(1);
  amandaAnim.setValue(0);
  amandaScaleAnim.setValue(1);
  optionGenAnim.setValue(0);
  optionGenScaleAnim.setValue(1);
  optionChalAnim.setValue(0);
  optionChalScaleAnim.setValue(1);

  const FADE_DUR = 400;
      // Start the fade-in. Update display values halfway through the fade so the
      // non-welcome UI transitions while the welcome keeps its own language/theme.
  Animated.timing(welcomeOpacityAnim, { toValue: 1, duration: FADE_DUR, useNativeDriver: true }).start(() => {
        // Apply the new language/theme to the welcome screen only after the fade completes
        try {
          setWelcomeLang(i18n.language);
          setWelcomeIsDark(theme === 'dark');
        } catch (e) {
          // ignore
        }
      });

  midpointTimerRef.current = setTimeout(() => {
        try {
          setDisplayLang(i18n.language);
          setDisplayIsDark(theme === 'dark');
        } catch (e) {}
        midpointTimerRef.current = null;
  }, 50);

      restartTimerRef.current = null;
  }, 250);

    return () => {
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      if (midpointTimerRef.current) {
        clearTimeout(midpointTimerRef.current);
        midpointTimerRef.current = null;
      }
    };
  }, [i18n.language, theme]);
  

  // Memoize theme-dependent values using the display (delayed) theme
  const isDark = useMemo(() => displayIsDark, [displayIsDark]);
  const accent = '#4dccc1';
  const cardBg = useMemo(() => isDark ? 'rgba(14,46,44,0.85)' : '#FFFFFF', [isDark]);
  
  // Memoize SVG colors to prevent recreation
  const svgColors = useMemo(() => isDark
    ? {
        petals: ['#22C55E', '#16A34A', '#4ADE80', '#15803D', '#166534', '#2E9A48'],
        center: '#16A34A',
        text: '#16A34A',
      }
    : {
        petals: ['#10B981', '#34D399', '#6EE7B7', '#059669', '#047857', '#22C55E'],
        center: '#1F2937',
        text: '#059669',
      }, [isDark]);

  // State
  const [step, setStep] = useState(() => skipWelcome ? 1 : 0);
  const [primary, setPrimary] = useState<'wellness' | 'productivity' | null>(null);
  const [wellnessPath, setWellnessPath] = useState<'general' | 'challenges' | null>(null);
  // Keep productivity card visible in step 2 even if user unselects it there
  const [showProductivityCard, setShowProductivityCard] = useState(false);
  // Track selection of the standalone (Amanda) productivity card independently
  const [amandaSelected, setAmandaSelected] = useState(false);
  
  const [isExporting, setIsExporting] = useState(false);
  const [showLanguages, setShowLanguages] = useState(false);
  // Local welcome-specific values: the welcome screen will use these so it doesn't
  // immediately reflect global language/theme changes. They are updated by the
  // delayed restart timer (after 1s) so welcome can show the new language/theme
  // only after the delay.
  const [welcomeLang, setWelcomeLang] = useState(i18n.language);
  const [welcomeIsDark, setWelcomeIsDark] = useState(theme === 'dark');
  // Single-pass gender cycling: compute vowel based on elapsed time since
  // welcome started so it cycles o -> a -> e once during the welcome stay.
  const WELCOME_STAY = 1200; // ms the welcome screen remains before auto-advance
  // no periodic rerender required for the welcome screen anymore
  // Fixed translator for the welcome screen that respects welcomeLang
  const tWelcome = useMemo(() => i18n.getFixedT(welcomeLang), [i18n, welcomeLang]);
  // Fixed translator used by the rest of the UI (updates at midpoint)
  const tDisplay = useMemo(() => i18n.getFixedT(displayLang), [i18n, displayLang]);
  
  // Screen dimensions with optimized listener
  const [size, setSize] = useState(() => {
    const { width, height, scale, fontScale } = Dimensions.get('window');
    return { width, height, scale, fontScale };
  });
  
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setSize(window);
    });
    return () => subscription?.remove();
  }, []);

  // Animation refs - all created once
  const slideAnim = useRef(new Animated.Value(0)).current;
  const welcomeOpacityAnim = useRef(new Animated.Value(0)).current;
  // If we were asked to skip the welcome, set the initial animation values so
  // the UI begins on step 1 without showing the welcome screen.
  useEffect(() => {
    if (skipWelcome) {
  welcomeOpacityAnim.setValue(0);
  slideAnim.setValue(-size.width * 1);
    }
  // Intentionally only run on mount or when skipWelcome/size.width change
  }, [skipWelcome, slideAnim, welcomeOpacityAnim, size.width]);
  const dropdownAnim = useRef(new Animated.Value(0)).current;
  // Reusable native-driven slide spring helper to keep spring config consistent
  // Use timing with easing for slide transitions to avoid spring bounce
  const SLIDE_SPRING = useCallback((toValue: number) => Animated.timing(slideAnim, {
    toValue,
    duration: 320,
    easing: Easing.out(Easing.cubic),
    useNativeDriver: true,
  }), [slideAnim]);
  // Timer ref used to schedule a delayed restart to the welcome step when language/theme changes
  const restartTimerRef = useRef<any>(null);
  
  // Selection animations
  const wellnessAnim = useRef(new Animated.Value(0)).current;
  const productivityAnim = useRef(new Animated.Value(0)).current;
  // Separate animated values for the secondary productivity card on step 2
  const amandaAnim = useRef(new Animated.Value(0)).current;
  const optionGenAnim = useRef(new Animated.Value(0)).current;
  const optionChalAnim = useRef(new Animated.Value(0)).current;
  // Separate scale animations so we can use native driver for transforms
  const wellnessScaleAnim = useRef(new Animated.Value(1)).current;
  const productivityScaleAnim = useRef(new Animated.Value(1)).current;
  const amandaScaleAnim = useRef(new Animated.Value(1)).current;
  const optionGenScaleAnim = useRef(new Animated.Value(1)).current;
  const optionChalScaleAnim = useRef(new Animated.Value(1)).current;
  
  // Button animations - separate for each button type
  const btnPressAnim = useRef(new Animated.Value(1)).current;
  const nextBtnPressAnim = useRef(new Animated.Value(1)).current;
  const signupBtnPressAnim = useRef(new Animated.Value(1)).current;
  const enabledAnimNext = useRef(new Animated.Value(0)).current;
  const enabledAnimSignup = useRef(new Animated.Value(0)).current;
  // Prevent overlapping selection animations
  const isSelectingRef = useRef(false);
  // Track which target+instance is currently animating so we can interrupt when user taps a different option
  const selectingTargetRef = useRef<{ target: 'wellness' | 'productivity'; instance: 'primary' | 'amanda' } | null>(null);
  // Debounce: disallow new selections within 300ms of last selection
  const lastSelectTimeRef = useRef<number>(0);

  // Memoize animated styles to prevent recreation
  const animatedStyles = useMemo(() => ({
    // Choice card scale transforms (pop effect) — driven by separate scale values (native driver)
    wellness: {
      transform: [{ scale: wellnessScaleAnim }]
    },
    productivity: {
      transform: [{ scale: productivityScaleAnim }]
    },
    amanda: {
      transform: [{ scale: amandaScaleAnim }]
    },
    optionGen: {
      transform: [{ scale: optionGenScaleAnim }]
    },
    optionChal: {
      transform: [{ scale: optionChalScaleAnim }]
    },
    btnPress: { 
      transform: [{ scale: btnPressAnim }] 
    },
    // Next button should not scale on press (no 'pop')
    nextBtnPress: {},
    signupBtnPress: { 
      transform: [{ scale: signupBtnPressAnim }] 
    },
    slide: {
      transform: [{ translateX: slideAnim }]
    },
    welcome: {
      opacity: welcomeOpacityAnim
    },
    dropdown: {
      opacity: dropdownAnim,
      transform: [{ 
        translateY: dropdownAnim.interpolate({ 
          inputRange: [0, 1], 
          outputRange: [-10, 0] 
        }) 
      }]
    }
  }), [wellnessAnim, productivityAnim, optionGenAnim, optionChalAnim, btnPressAnim, nextBtnPressAnim, signupBtnPressAnim, slideAnim, welcomeOpacityAnim, dropdownAnim]);

  // Ensure initial state is fully unselected on mount (defensive):
  // reset all selection animated values and visibility flags so no card appears pre-selected.
  useEffect(() => {
    wellnessAnim.setValue(0);
    productivityAnim.setValue(0);
  amandaAnim.setValue(0);
    optionGenAnim.setValue(0);
    optionChalAnim.setValue(0);
    wellnessScaleAnim.setValue(1);
    productivityScaleAnim.setValue(1);
  amandaScaleAnim.setValue(1);
    optionGenScaleAnim.setValue(1);
    optionChalScaleAnim.setValue(1);
  setPrimary(null);
  setWellnessPath(null);
  setShowProductivityCard(false);
  }, []);

  // Memoize enabled state calculation
  const isNextEnabled = useMemo(() => {
    if (step === 0) return false;
    if (step === 1) return primary !== null;
    if (step === 2) {
      if (primary === 'wellness') {
        return wellnessPath !== null;
      }
      // For step 2 productivity path require an explicit Amanda selection
      // (primary was chosen on step 1; don't auto-enable just because there's only one node)
      return amandaSelected;
    }
    return false;
  }, [step, primary, wellnessPath, amandaSelected]);

  // Update enabled animations when state changes - SEPARATE for next vs signup
  useEffect(() => {
  const nextEnabled = step === 1 && primary !== null;
  // Match the same rule used in isNextEnabled: for productivity require explicit Amanda selection
  const signupEnabled = step === 2 && (primary === 'wellness' ? wellnessPath !== null : amandaSelected);
    
    Animated.timing(enabledAnimNext, { 
      toValue: nextEnabled ? 1 : 0, 
      duration: 300, 
      useNativeDriver: true 
    }).start();
    
    Animated.timing(enabledAnimSignup, { 
      toValue: signupEnabled ? 1 : 0, 
      duration: 300, 
      useNativeDriver: true 
    }).start();
  }, [step, primary, wellnessPath, amandaSelected, enabledAnimNext, enabledAnimSignup]);

  // Navigation guard
  const isNavigatingRef = useRef(false);
  const navigateOnce = useCallback((path: string) => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    
    InteractionManager.runAfterInteractions(() => {
      try {
  router.replace(path as any);
        // After navigation completes, clear the navigating flag shortly after.
        setTimeout(() => {
          isNavigatingRef.current = false;
        }, 1000);

        // If this onboarding was opened from the login screen and we're
        // navigating to a login path, schedule a quick termination to stop
        // heavy onboarding animations/work that may otherwise keep running
        // in the background and cause input lag.
  if (openedFromLogin && path && (path.includes('/screens/LoginScreen') || path.includes('/LoginScreen') || path.includes('/ign-LoginScreen'))) {
          if (terminationTimerRef.current) clearTimeout(terminationTimerRef.current);
          terminationTimerRef.current = setTimeout(() => {
            try {
              terminateOnboarding();
            } catch (e) {}
            terminationTimerRef.current = null;
          }, 500);
        }
      } catch (error) {
        console.error('Navigation failed:', error);
        isNavigatingRef.current = false;
      }
    });
  }, [router]);

  // Stop animations, timers and render a lightweight placeholder. This avoids
  // duplicated interactive work when onboarding is left open after a quick
  // back/navigation to the login screen.
  const terminateOnboarding = useCallback(() => {
    try {
      // stop selection/choice animations
      wellnessAnim.stopAnimation();
      productivityAnim.stopAnimation();
      amandaAnim.stopAnimation();
      optionGenAnim.stopAnimation();
      optionChalAnim.stopAnimation();

      // stop scale animations
      wellnessScaleAnim.stopAnimation();
      productivityScaleAnim.stopAnimation();
      amandaScaleAnim.stopAnimation();
      optionGenScaleAnim.stopAnimation();
      optionChalScaleAnim.stopAnimation();

      // stop other UI animations
      slideAnim.stopAnimation();
      welcomeOpacityAnim.stopAnimation();
      dropdownAnim.stopAnimation();
      btnPressAnim.stopAnimation();
      nextBtnPressAnim.stopAnimation();
      signupBtnPressAnim.stopAnimation();
      enabledAnimNext.stopAnimation();
      enabledAnimSignup.stopAnimation();
    } catch (e) {
      // ignore stop failures
    }

    // Clear any scheduled restart/midpoint timers
    try {
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      if (midpointTimerRef.current) {
        clearTimeout(midpointTimerRef.current);
        midpointTimerRef.current = null;
      }
      // Clear welcome timers/intervals so repeated opens cannot accumulate them
      if (welcomeAutoAdvanceTimerRef.current) {
        clearTimeout(welcomeAutoAdvanceTimerRef.current as any);
        welcomeAutoAdvanceTimerRef.current = null;
      }
  // welcome rerender interval removed
    } catch (e) {}

    // Render the lightweight terminated state
    setTerminated(true);
  }, [wellnessAnim, productivityAnim, amandaAnim, optionGenAnim, optionChalAnim, wellnessScaleAnim, productivityScaleAnim, amandaScaleAnim, optionGenScaleAnim, optionChalScaleAnim, slideAnim, welcomeOpacityAnim, dropdownAnim, btnPressAnim, nextBtnPressAnim, signupBtnPressAnim, enabledAnimNext, enabledAnimSignup]);

  // Language dropdown functions
  const toggleLanguageDropdown = useCallback(() => {
    if (!showLanguages) {
      setShowLanguages(true);
      // Use timing with native driver for consistency to avoid JS/native driver mixing
      Animated.timing(dropdownAnim, { 
        toValue: 1, 
        duration: 240,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(dropdownAnim, { 
        toValue: 0, 
        duration: 200, 
        useNativeDriver: true 
      }).start(() => setShowLanguages(false));
    }
  }, [showLanguages, dropdownAnim]);

  const selectLanguage = useCallback((langCode: string) => {
    i18n.changeLanguage(langCode);
    Animated.timing(dropdownAnim, { 
      toValue: 0, 
      duration: 200, 
      useNativeDriver: true 
    }).start(() => setShowLanguages(false));
  }, [i18n, dropdownAnim]);

  // Welcome screen auto-advance
  const welcomeAutoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animateStepRef = useRef<((direction: 'forward' | 'back') => void) | null>(null);
  useEffect(() => {
    // If we're skipping welcome (e.g., opened from login), don't run fade/auto-advance
    if (skipWelcome) {
      if (welcomeAutoAdvanceTimerRef.current) {
        clearTimeout(welcomeAutoAdvanceTimerRef.current as any);
        welcomeAutoAdvanceTimerRef.current = null;
      }
      return;
    }

    // Always reset any previous timer when effect runs
    if (welcomeAutoAdvanceTimerRef.current) {
      clearTimeout(welcomeAutoAdvanceTimerRef.current as any);
      welcomeAutoAdvanceTimerRef.current = null;
    }

    if (step === 0) {
      welcomeOpacityAnim.setValue(0);
      const fadeIn = Animated.timing(welcomeOpacityAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      });

      fadeIn.start(() => {
        // schedule auto-advance and keep a ref so we can clear it on unmount
        welcomeAutoAdvanceTimerRef.current = setTimeout(() => {
          if (step === 0) animateStepRef.current?.('forward');
          welcomeAutoAdvanceTimerRef.current = null;
        }, WELCOME_STAY);
      });
    }

    return () => {
      if (welcomeAutoAdvanceTimerRef.current) {
        clearTimeout(welcomeAutoAdvanceTimerRef.current as any);
        welcomeAutoAdvanceTimerRef.current = null;
      }
    };
  }, [step, welcomeOpacityAnim, skipWelcome]);

  // Optimized step animation
  const animateStep = useCallback((direction: 'forward' | 'back') => {
    const newStep = direction === 'forward' ? Math.min(2, step + 1) : Math.max(0, step - 1);

    // Stop all animations (but this should NOT imply a selection is in-progress)
    [wellnessAnim, productivityAnim, optionGenAnim, optionChalAnim, welcomeOpacityAnim].forEach(anim => {
      anim.stopAnimation();
    });
    // Ensure selection guard isn't accidentally left enabled by unrelated animation stops
    // (only selection handlers should set this true)
    isSelectingRef.current = false;

    if (step === 0 && direction === 'forward') {
      Animated.timing(welcomeOpacityAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setStep(newStep);
        // start slide and allow interactions immediately (don't wait for spring to finish)
        SLIDE_SPRING(-newStep * size.width).start(() => {
          // finishing a step animation should not block selection (cleanup)
          isSelectingRef.current = false;
        });
        // make UI responsive immediately after animation starts
        isSelectingRef.current = false;
      });
    } else {
      setStep(newStep);
      // start slide and allow interactions immediately (don't wait for spring to finish)
      SLIDE_SPRING(-newStep * size.width).start(() => {
        // finishing a step animation should not block selection (cleanup)
        isSelectingRef.current = false;
      });
      // make UI responsive immediately after animation starts
      isSelectingRef.current = false;

      if (newStep === 0) {
        welcomeOpacityAnim.setValue(1);
      }
    }
  }, [step, size.width, slideAnim, welcomeOpacityAnim, wellnessAnim, productivityAnim, optionGenAnim, optionChalAnim]);

  // Keep a ref to animateStep so earlier effects can call it without
  // depending on declaration order.
  animateStepRef.current = animateStep;

  // Button press handlers - separate for each button
  const onBtnPressIn = useCallback(() => {
    btnPressAnim.stopAnimation();
    Animated.spring(btnPressAnim, { 
      toValue: 0.96, 
      useNativeDriver: true, 
      friction: 8, 
      tension: 100 
    }).start();
  }, [btnPressAnim]);

  const onBtnPressOut = useCallback(() => {
    btnPressAnim.stopAnimation();
    Animated.spring(btnPressAnim, { 
      toValue: 1, 
      useNativeDriver: true, 
      friction: 8, 
      tension: 100 
    }).start();
  }, [btnPressAnim]);

  const onNextPressIn = useCallback(() => {
    nextBtnPressAnim.stopAnimation();
    Animated.spring(nextBtnPressAnim, { 
      toValue: 0.96, 
      useNativeDriver: true, 
      friction: 8, 
      tension: 100 
    }).start();
  }, [nextBtnPressAnim]);

  const onNextPressOut = useCallback(() => {
    nextBtnPressAnim.stopAnimation();
    Animated.spring(nextBtnPressAnim, { 
      toValue: 1, 
      useNativeDriver: true, 
      friction: 8, 
      tension: 100 
    }).start();
  }, [nextBtnPressAnim]);

  const onSignupPressIn = useCallback(() => {
    signupBtnPressAnim.stopAnimation();
    Animated.spring(signupBtnPressAnim, { 
      toValue: 0.96, 
      useNativeDriver: true, 
      friction: 8, 
      tension: 100 
    }).start();
  }, [signupBtnPressAnim]);

  const onSignupPressOut = useCallback(() => {
    signupBtnPressAnim.stopAnimation();
    Animated.spring(signupBtnPressAnim, { 
      toValue: 1, 
      useNativeDriver: true, 
      friction: 8, 
      tension: 100 
    }).start();
  }, [signupBtnPressAnim]);

  // Selection handlers — STRICT: state is 0 or 1. When turning ON (to 1) run EXACTLY two animations
  // (color and scale) with the same duration; when turning OFF (to 0) run the opposite animations
  // with the same duration. If the other option is 1, set it to 0 with the same paired animations.
  // RESTRICTIVE BINARY LOGIC: 0 (initial) or 1 (on)
  // State 1 triggers EXACTLY TWO animations with identical timing, no exceptions
  // Clicking selected option turns it to 0, clicking other turns it to 1 and other to 0
  // Helper: run an animation while holding the selection guard; ensures guard clears on complete
  const runGuardedAnimation = useCallback((anim: Animated.CompositeAnimation, tag: { target: 'wellness' | 'productivity'; instance: 'primary' | 'amanda' }, onComplete?: () => void) => {
    // If another selection animation is running for the same tag, ignore
    if (isSelectingRef.current && selectingTargetRef.current && selectingTargetRef.current.target === tag.target && selectingTargetRef.current.instance === tag.instance) return false;
    // If another animation is running for a different tag, stop it and proceed
    if (isSelectingRef.current && selectingTargetRef.current && (selectingTargetRef.current.target !== tag.target || selectingTargetRef.current.instance !== tag.instance)) {
      // stop animations immediately (we assume caller has already stopped relevant Animated.Value instances)
      // clear the previous tag so we can set the new one
      selectingTargetRef.current = null;
      isSelectingRef.current = false;
    }
    isSelectingRef.current = true;
    selectingTargetRef.current = tag;
    const wrapped = Animated.sequence([anim]);
    wrapped.start(() => {
      isSelectingRef.current = false;
      selectingTargetRef.current = null;
      if (onComplete) onComplete();
    });
    return true;
  }, []);

  // `instance` is optional: 'primary' (step1) or 'amanda' (step2). When omitted, defaults to 'primary'.
  const animateSelection = useCallback((target: 'wellness' | 'productivity', instance: 'primary' | 'amanda' = 'primary') => {
    const DURATION = 100; // faster node pop timing

      const now = Date.now();
      if (now - lastSelectTimeRef.current < 150) return; // ignore very rapid clicks
    lastSelectTimeRef.current = now;

    // If a page swipe/fade is running, stop it so node selection can proceed immediately
    try {
      slideAnim.stopAnimation();
      welcomeOpacityAnim.stopAnimation();
      dropdownAnim.stopAnimation();
    } catch (e) {}

    // Clear any lingering timers that may re-trigger page transitions or keep the UI blocked
    try {
      if (restartTimerRef.current) { clearTimeout(restartTimerRef.current); restartTimerRef.current = null; }
      if (midpointTimerRef.current) { clearTimeout(midpointTimerRef.current); midpointTimerRef.current = null; }
      if (welcomeAutoAdvanceTimerRef.current) { clearTimeout(welcomeAutoAdvanceTimerRef.current as any); welcomeAutoAdvanceTimerRef.current = null; }
      if (terminationTimerRef.current) { clearTimeout(terminationTimerRef.current as any); terminationTimerRef.current = null; }
    } catch (e) {}

    // Clear any transient selection guard so taps are not blocked by previous page transitions
    isSelectingRef.current = false;
    selectingTargetRef.current = null;

    // Stop non-selection animations but don't assume selection guard should be set here
    wellnessAnim.stopAnimation();
    productivityAnim.stopAnimation();
    amandaAnim.stopAnimation();
    wellnessScaleAnim.stopAnimation();
    productivityScaleAnim.stopAnimation();
    amandaScaleAnim.stopAnimation();

    // Case 1: Clicking currently selected (state 1) -> turn to 0
    // For the Amanda instance, check `amandaSelected`; for primary use `primary`.
    const isCurrentlySelected = instance === 'amanda' ? (amandaSelected && target === 'productivity') : (target === primary);
    if (isCurrentlySelected) {
      const targetColorAnim = target === 'wellness' ? wellnessAnim : (instance === 'amanda' ? amandaAnim : productivityAnim);
      const targetScaleAnim = target === 'wellness' ? wellnessScaleAnim : (instance === 'amanda' ? amandaScaleAnim : productivityScaleAnim);

      // Turn OFF: TWO animations with identical timing
      const offAnim = Animated.parallel([
        Animated.timing(targetColorAnim, { toValue: 0, duration: DURATION, useNativeDriver: true }),
        Animated.timing(targetScaleAnim, { toValue: 1, duration: DURATION, useNativeDriver: true }),
      ]);

      // Try to run via guarded helper. If the guard blocks (e.g., the same
      // tag is currently animating), still run the OFF animation directly so
      // the user can unselect (important for Amanda toggle UX).
      const started = runGuardedAnimation(offAnim, { target, instance }, () => {
        if (instance === 'amanda') {
          setAmandaSelected(false);
        } else {
          setPrimary(null); // Now both are 0
        }
        lastSelectTimeRef.current = Date.now();
      });
      if (!started) {
        // Guard blocked; run the OFF animation directly but still set the guard
        try {
          // Stop any conflicting animations first
          targetColorAnim.stopAnimation();
          targetScaleAnim.stopAnimation();
        } catch (e) {}
        isSelectingRef.current = true;
        selectingTargetRef.current = { target, instance };
        offAnim.start(() => {
          if (instance === 'amanda') {
            setAmandaSelected(false);
          } else {
            setPrimary(null);
          }
          lastSelectTimeRef.current = Date.now();
          isSelectingRef.current = false;
          selectingTargetRef.current = null;
        });
      }
      return;
    }

    // Case 2: Clicking non-selected -> turn target to 1, other to 0 (if not already 0)
  const targetColorAnim = target === 'wellness' ? wellnessAnim : (instance === 'amanda' ? amandaAnim : productivityAnim);
  const targetScaleAnim = target === 'wellness' ? wellnessScaleAnim : (instance === 'amanda' ? amandaScaleAnim : productivityScaleAnim);
  const otherOption = target === 'wellness' ? 'productivity' : 'wellness';

  // Build the 'turn off' animations robustly:
  // - If otherOption is 'wellness', just turn wellness off.
  // - If otherOption is 'productivity', turn off any productivity instance that is NOT the current target (this ensures no lingering highlight).
  const makeTurnOffAnims = () => {
    const list: Animated.CompositeAnimation[] = [];
    if (otherOption === 'wellness') {
      list.push(
        Animated.timing(wellnessAnim, { toValue: 0, duration: DURATION, useNativeDriver: true }),
        Animated.timing(wellnessScaleAnim, { toValue: 1, duration: DURATION, useNativeDriver: true }),
      );
    } else {
      // otherOption === 'productivity'
      // If primary productivity is not the current target animation, turn it off
      if (productivityAnim !== targetColorAnim) {
        list.push(
          Animated.timing(productivityAnim, { toValue: 0, duration: DURATION, useNativeDriver: true }),
          Animated.timing(productivityScaleAnim, { toValue: 1, duration: DURATION, useNativeDriver: true }),
        );
      }
      // If Amanda productivity is not the current target animation, turn it off
      if (amandaAnim !== targetColorAnim) {
        list.push(
          Animated.timing(amandaAnim, { toValue: 0, duration: DURATION, useNativeDriver: true }),
          Animated.timing(amandaScaleAnim, { toValue: 1, duration: DURATION, useNativeDriver: true }),
        );
      }
    }
    return list;
  };

    // Turn target ON (1): TWO animations with identical timing
    const turnOn = Animated.parallel([
      Animated.timing(targetColorAnim, { toValue: 1, duration: DURATION, useNativeDriver: true }),
      Animated.timing(targetScaleAnim, { toValue: 1.03, duration: DURATION, useNativeDriver: true }),
    ]);

    // Turn other OFF (0): build either one or multiple paired animations
    const turnOffAnims = makeTurnOffAnims();
    const turnOff = turnOffAnims.length > 0 ? Animated.parallel(turnOffAnims) : Animated.delay(0);

    const combined = Animated.parallel([turnOn, turnOff]);
  const started = runGuardedAnimation(combined, { target, instance }, () => {
      if (instance === 'amanda') {
        setAmandaSelected(true);
      } else {
        setPrimary(target);
      }
      lastSelectTimeRef.current = Date.now();
    });
    if (!started) return;
  }, [primary, amandaSelected, wellnessAnim, productivityAnim, amandaAnim, wellnessScaleAnim, productivityScaleAnim, amandaScaleAnim, runGuardedAnimation]);

  // Wellness subpath selection — animate color crossfades for sub-options
  const animateWellnessPath = useCallback((target: 'general' | 'challenges') => {
    const DURATION = 100;

    const now = Date.now();
    if (now - lastSelectTimeRef.current < 150) return; // ignore very rapid clicks
  lastSelectTimeRef.current = now;

  // Block input until animations complete
  if (isSelectingRef.current) return;
  isSelectingRef.current = true;

    optionGenAnim.stopAnimation();
    optionChalAnim.stopAnimation();
    optionGenScaleAnim.stopAnimation();
    optionChalScaleAnim.stopAnimation();

    if (target === wellnessPath) {
      // turn the selected sub-option OFF
      Animated.parallel([
        Animated.timing(target === 'general' ? optionGenAnim : optionChalAnim, { toValue: 0, duration: DURATION, useNativeDriver: true }),
        Animated.timing(target === 'general' ? optionGenScaleAnim : optionChalScaleAnim, { toValue: 1, duration: DURATION, useNativeDriver: true }),
      ]).start(() => {
        setWellnessPath(null);
        isSelectingRef.current = false;
      });
      return;
    }

  // Turn the chosen sub-option ON (1) and the other OFF (0), both via paired timings
  // Defer state update until animations finish so visuals lead state
  const makeOn = (which: 'general' | 'challenges') => Animated.parallel([
      Animated.timing(which === 'general' ? optionGenAnim : optionChalAnim, { toValue: 1, duration: DURATION, useNativeDriver: true }),
      Animated.timing(which === 'general' ? optionGenScaleAnim : optionChalScaleAnim, { toValue: 1.03, duration: DURATION, useNativeDriver: true }),
    ]);

    const makeOff = (which: 'general' | 'challenges') => Animated.parallel([
      Animated.timing(which === 'general' ? optionGenAnim : optionChalAnim, { toValue: 0, duration: DURATION, useNativeDriver: true }),
      Animated.timing(which === 'general' ? optionGenScaleAnim : optionChalScaleAnim, { toValue: 1, duration: DURATION, useNativeDriver: true }),
    ]);

    const other = target === 'general' ? 'challenges' : 'general';

    Animated.parallel([
      makeOn(target),
      makeOff(other as 'general' | 'challenges'),
    ]).start(() => {
  setWellnessPath(target);
  isSelectingRef.current = false;
  lastSelectTimeRef.current = Date.now();
    });
  }, [wellnessPath, optionGenAnim, optionChalAnim]);

  // Navigation handlers
  const next = useCallback(async () => {
    if (step === 0) {
      animateStep('forward');
      return;
    }

    if (step === 1) {
      if (!primary) return;
      animateStep('forward');
      return;
    }

    if (step === 2) {
      if (primary === 'wellness' && !wellnessPath) return;
      if (isExporting) return; // guard double taps
      setIsExporting(true);
      try {
        // Re-enable exporting selected plans for the login -> onboarding handoff
        await exportSelectedPlans({ primary, wellnessPath, amandaSelected }, tDisplay as any);
      } catch (e) {
        // continue regardless
      } finally {
        setIsExporting(false);
      }
  // Navigate to the login route and explicitly request signup mode so the
  // login screen initializes the correct pane after onboarding finishes.
  navigateOnce('/(tabs)/ign-LoginScreen?mode=signup&from=onboarding' as any);
    }
  }, [step, primary, wellnessPath, animateStep, navigateOnce]);

  const back = useCallback(() => {
  // Prevent going back during exporting/navigation to avoid transient back navigation
  if (isExporting || isNavigatingRef.current) return;

  if (step === 2) {
      setWellnessPath(null);
      Animated.parallel([
        Animated.timing(optionGenAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(optionChalAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.spring(optionGenScaleAnim, { toValue: 1, useNativeDriver: true, friction: 9, tension: 120 }),
        Animated.spring(optionChalScaleAnim, { toValue: 1, useNativeDriver: true, friction: 9, tension: 120 }),
        // Clear Amanda's animations
        Animated.timing(amandaAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.spring(amandaScaleAnim, { toValue: 1, useNativeDriver: true, friction: 9, tension: 120 }),
      ]).start();
    } else {
      setPrimary(null);
      setWellnessPath(null);
      Animated.parallel([
        Animated.timing(wellnessAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(productivityAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(optionGenAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(optionChalAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.spring(wellnessScaleAnim, { toValue: 1, useNativeDriver: true, friction: 9, tension: 120 }),
        Animated.spring(productivityScaleAnim, { toValue: 1, useNativeDriver: true, friction: 9, tension: 120 }),
      ]).start();
    }
    animateStep('back');
  }, [step, animateStep, wellnessAnim, productivityAnim, optionGenAnim, optionChalAnim]);

  // Keep the productivity card visible when user reaches step 2 with productivity selected,
  // and allow it to persist if they unselect while on step 2. Clear whenever leaving step 2
  useEffect(() => {
    if (step !== 2) {
      setShowProductivityCard(false);
      return;
    }
    if (primary === 'productivity') {
      setShowProductivityCard(true);
    } else if (primary === null) {
      // if user unselected while on step 2, keep the card visible (do not clear)
    } else {
      // some other primary (e.g., wellness) should hide it
      setShowProductivityCard(false);
    }
  }, [step, primary]);

  // Ensure the standalone secondary productivity card does not mount visually selected
  // when the actual state doesn't indicate selection. This resets the animated values
  // used for visual highlighting whenever step 2 mounts and `primary` is not 'productivity'.
  useEffect(() => {
    if (step === 2 && primary !== 'productivity') {
      // immediately set visuals to unselected
      try {
  // clear both productivity visuals to be safe
  productivityAnim.setValue(0);
  productivityScaleAnim.setValue(1);
  amandaAnim.setValue(0);
  amandaScaleAnim.setValue(1);
      } catch (e) {}
    }
  }, [step, primary, productivityAnim, productivityScaleAnim]);

  // Memoized styles
  const styles = useMemo(() => getStyles(isDark), [isDark]);
  
  const languages = useMemo(() => [
    { code: 'pt-BR', name: 'Português Brasileiro' },
    { code: 'es', name: 'Español' },
    { code: 'en', name: 'English' },
  ], []);

 // Memoized components
   const Logo = useMemo(() => ({ width = 340, height = 102 }: { width?: number; height?: number }) => (
     <Svg width={width} height={height} viewBox="0 0 500 150" preserveAspectRatio="xMidYMid meet">
       <G transform="translate(129,75)">
         <Circle cx="0" cy="-20" r="8" fill={svgColors.petals[0]} />
         <Circle cx="17" cy="-10" r="8" fill={svgColors.petals[1]} />
         <Circle cx="17" cy="10" r="8" fill={svgColors.petals[2]} />
         <Circle cx="0" cy="20" r="8" fill={svgColors.petals[3]} />
         <Circle cx="-17" cy="10" r="8" fill={svgColors.petals[4]} />
         <Circle cx="-17" cy="-10" r="8" fill={svgColors.petals[5]} />
         <Circle cx="0" cy="0" r="6" fill={svgColors.center} />
       </G>
       <G>
         <SvgText x="179" y="93" fontFamily="system-ui, -apple-system, sans-serif" fontSize="52" fontWeight="900" fill={svgColors.text}>
           Florescer
         </SvgText>
       </G>
     </Svg>
   ), [svgColors]);
   // Logo component

  const ChoiceOption = useMemo(() => ({ icon, title, description }: { 
    icon: React.ComponentProps<typeof Ionicons>['name']; 
    title: string; 
    description: string 
  }) => (
    <View style={styles.choiceContainer}>
      <View style={styles.choiceIcon}>
        <Ionicons name={icon} size={28} color={accent} />
      </View>
      <View style={styles.choiceTextWrap}>
  <Text style={styles.choiceTitle}>{title}</Text>
  <Text style={styles.choiceDescription}>{description}</Text>
      </View>
    </View>
  ), [styles, accent]);
  // ChoiceOption component

  // Memoize button styles with consistent borders
  const buttonStyles = useMemo(() => ({
    bg: { backgroundColor: cardBg },
    // All buttons get grey borders
    greyBorder: { borderColor: isDark ? '#4B5563' : '#9CA3AF', borderWidth: 1 },
    // Choice cards get accent borders  
    accentBorder: { borderColor: accent, borderWidth: 1 },
    disabledText: { color: isDark ? '#9CA3AF' : '#6B7280' },
    enabledText: { color: accent },
    overlay: {
      // nodeBase: stronger highlight used for choice nodes
      nodeBase: isDark ? 'rgba(77,204,193,0.36)' : 'rgba(77,204,193,0.36)',
  // buttonBase: distinct, toned-down teal so buttons don't reuse the exact node color components
  // chosen to sit in the same family but with different RGB channels
  buttonBase: isDark ? 'rgba(15,118,110,0.12)' : 'rgba(15,118,110,0.10)',
      disabled: isDark ? 'rgba(75,85,99,0.06)' : 'rgba(156,163,175,0.06)'
    }
  }), [cardBg, isDark, accent]);

  const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

  // If the onboarding was terminated (short-circuit), render a lightweight
  // placeholder to avoid a blank screen while we ensure navigation finishes.
  useEffect(() => {
  if (terminated) {
      try {
    // Make sure router is on the canonical login screen.
  router.replace('/(tabs)/ign-LoginScreen' as any);
      } catch (e) {
        // ignore navigation errors
      }
    }
  }, [terminated, router]);

  if (terminated) {
    return (
      <View style={getStyles(displayIsDark).root}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={accent} />
          <Text style={{ marginTop: 12, color: accent }}>{tDisplay('onboarding.returning_to_login') ?? 'Returning to login...'}</Text>
        </View>
      </View>
    );
  }

  return (
    <Providers>
    <View style={styles.root}>
      {step !== 0 && (
        <Animated.View style={styles.topButtonsContainer}>
          <TouchableOpacity style={styles.themeButton} onPress={toggleTheme}>
            <Ionicons name={displayIsDark ? 'moon-outline' : 'sunny-outline'} size={22} color="#4DCCC1" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.languageButton, showLanguages && styles.languageButtonActive]} 
            onPress={toggleLanguageDropdown}
          >
            <Ionicons name="language-outline" size={22} color="#4DCCC1" />
            <Animated.View style={{ marginLeft: 2, transform: [{ rotate: dropdownAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }}>
              {/* keep a single chevron glyph and rotate it for a smooth native-driven animation */}
              <Ionicons name="chevron-down" size={16} color="#4DCCC1" />
            </Animated.View>
          </TouchableOpacity>

          {showLanguages && (
            <>
              <TouchableWithoutFeedback onPress={toggleLanguageDropdown}>
                <Animated.View 
                  style={[
                    styles.dropdownBackdrop, 
                    { 
                      opacity: dropdownAnim.interpolate({ 
                        inputRange: [0, 0.1, 1], 
                        outputRange: [0, 0, 0.5] 
                      }) 
                    }
                  ]} 
                />
              </TouchableWithoutFeedback>

              <View style={styles.languageDropdownContainer}>
                <Animated.View style={[styles.languageDropdown, animatedStyles.dropdown]}>
                  {languages.map((lang, idx) => (
                    <TouchableOpacity 
                      key={lang.code}
                      style={[
                        styles.languageOption, 
                        idx < languages.length - 1 ? styles.languageOptionDivider : null,
                        displayLang === lang.code && styles.languageOptionActive
                      ]} 
                      onPress={() => selectLanguage(lang.code)}
                    >
                      <Text
                        style={[
                          styles.languageOptionText, 
                          displayLang === lang.code && styles.languageOptionTextActive
                        ]}
                      >
                        {lang.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </Animated.View>
              </View>
            </>
          )}
        </Animated.View>
      )}

      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Animated.View
          style={[
            {
              flexDirection: 'row',
              width: size.width * 3,
              height: size.height,
            },
            animatedStyles.slide
          ]}
        >
          {/* Step 0: Welcome */}
          <Animated.View style={[
            { width: size.width, height: size.height, justifyContent: 'center', alignItems: 'center' },
            animatedStyles.welcome
          ]}>
            <Animated.View style={[
              { width: size.width, height: size.height, justifyContent: 'center', alignItems: 'center', backgroundColor: welcomeIsDark ? '#0A1E1C' : '#FFFFFF' },
              animatedStyles.welcome
            ]}>
              <Text style={styles.welcomeTitle}>
                  {tWelcome('onboarding.welcome_title', {
                  o: welcomeLang === 'es' ? 'o' : 'o'
                })}
              </Text>
              <Text style={styles.welcomeSubtitle}>
                {tWelcome('onboarding.welcome_subtitle', { o: 'o' })}
              </Text>
            </Animated.View>
          </Animated.View>

          {/* Step 1: Primary choice */}
          <View style={{ width: size.width, height: size.height, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <View style={{ alignItems: 'center', width: '100%' }}>
              <View style={{ alignItems: 'center', marginBottom: 15 }}>
                <Logo />
              </View>
              
              <Text style={styles.stepHeading}>
                {tDisplay('onboarding.step1_heading')}
              </Text>

              <AnimatedPressable 
                style={[
                  styles.choiceCard,
                  buttonStyles.bg,
                  // Page 1 nodes should use the accent outline regardless of selection
                  buttonStyles.accentBorder,
                  animatedStyles.wellness
                ]}
                onPress={() => animateSelection('wellness')}
                hitSlop={styles.hitSlop}
                pressRetentionOffset={styles.pressRetention}
              >
                {/* Single smooth overlay for wellness card */}
                <Animated.View
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFill,
                    {
                      borderRadius: 12,
                      backgroundColor: buttonStyles.overlay.nodeBase,
                      opacity: wellnessAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] })
                    }
                  ]}
                />
                <ChoiceOption 
                  icon="leaf" 
                  title={tDisplay('onboarding.option_wellness_title')} 
                  description={tDisplay('onboarding.option_wellness_desc')} 
                />
              </AnimatedPressable>

              <AnimatedPressable 
                style={[
                  styles.choiceCard,
                  buttonStyles.bg,
                  // Page 1 nodes should use the accent outline regardless of selection
                  buttonStyles.accentBorder,
                  animatedStyles.productivity
                ]}
                onPress={() => animateSelection('productivity')}
                hitSlop={styles.hitSlop}
                pressRetentionOffset={styles.pressRetention}
              >
                {/* Single smooth overlay for productivity card */}
                <Animated.View
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFill,
                    {
                      borderRadius: 12,
                      backgroundColor: buttonStyles.overlay.nodeBase,
                      opacity: productivityAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] })
                    }
                  ]}
                />
                <ChoiceOption 
                  icon="rocket" 
                  title={tDisplay('onboarding.option_productivity_title')} 
                  description={tDisplay('onboarding.option_productivity_desc')} 
                />
              </AnimatedPressable>

              <View style={styles.buttonContainer}>
                <AnimatedPressable 
                  onPress={next}
                  disabled={!isNextEnabled}
                  style={[
                    styles.nextButtonLarge,
                    buttonStyles.bg,
                    isNextEnabled ? buttonStyles.accentBorder : buttonStyles.greyBorder,
                    animatedStyles.nextBtnPress
                  ]}
                  hitSlop={styles.hitSlop}
                  pressRetentionOffset={styles.pressRetention}
                >
                  {/* Smooth color crossfade overlays */}
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      StyleSheet.absoluteFill,
                      {
                        borderRadius: 12,
                        backgroundColor: buttonStyles.overlay.disabled,
                        opacity: enabledAnimNext.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.5, 0] })
                      }
                    ]}
                  />
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      StyleSheet.absoluteFill,
                      {
                        borderRadius: 12,
                        backgroundColor: buttonStyles.overlay.buttonBase,
                        opacity: enabledAnimNext.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.5, 1] })
                      }
                    ]}
                  />
                  <Animated.Text 
                    style={[
                      styles.nextTextLarge, 
                      { 
                        position: 'absolute', 
                        left: 0, right: 0, textAlign: 'center',
                        opacity: enabledAnimNext.interpolate({ inputRange: [0, 1], outputRange: [1, 0] })
                      }, 
                      buttonStyles.disabledText
                    ]}
                  >
                    {tDisplay('onboarding.next')}
                  </Animated.Text>
                  <Animated.Text 
                    style={[
                      styles.nextTextLarge, 
                      { position: 'absolute', left: 0, right: 0, textAlign: 'center', opacity: enabledAnimNext }, 
                      buttonStyles.enabledText
                    ]}
                  >
                    {tDisplay('onboarding.next')}
                  </Animated.Text>
                </AnimatedPressable>
                <View style={{ marginTop: 10, alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: '#6B7280' }}>{String(tDisplay('auth.links.have_account')).trimEnd()}</Text>
                    <TouchableOpacity onPress={async () => {
                        try {
                          // Clear exported onboarding selections from storage so they don't affect login flows
                          try {
                            await clearSelectedPlans();
                          } catch (e) {
                            console.warn('[onboarding] clearSelectedPlans failed', e);
                          }
                          try {
                            await AsyncStorage.removeItem('enabledModules');
                          } catch (e) {
                            console.warn('[onboarding] remove enabledModules failed', e);
                          }
                        } catch (e) {}
                        navigateOnce('/(tabs)/ign-LoginScreen?mode=login&from=onboarding' as any);
                      }}>
                      <Text style={{ color: '#4dccc1', fontWeight: '700', marginLeft: 4 }}>{tDisplay('auth.buttons.login')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Step 2: Secondary choice */}
          <View style={{ width: size.width, height: size.height, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <View style={{ alignItems: 'center', width: '100%' }}>
              {/* Logo for step 2: sits 15px above the heading */}
              <View style={{ alignItems: 'center', marginBottom: 15 }}>
                <Logo />
              </View>
              
              <Text style={styles.stepHeading}>
                {tDisplay('onboarding.step2_heading')}
              </Text>

              {primary === 'wellness' && (
                <>
                  <AnimatedPressable 
                    style={[styles.choiceCard, buttonStyles.bg, buttonStyles.accentBorder, animatedStyles.optionGen]}
                    onPress={() => animateWellnessPath('general')}
                    hitSlop={styles.hitSlop}
                    pressRetentionOffset={styles.pressRetention}
                  >
                    {/* Single smooth overlay for general wellness option */}
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        StyleSheet.absoluteFill,
                        {
                          borderRadius: 12,
                          backgroundColor: buttonStyles.overlay.nodeBase,
                          opacity: optionGenAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] })
                        }
                      ]}
                    />
                    <ChoiceOption 
                      icon="heart" 
                      title={tDisplay('onboarding.option_general_title')} 
                      description={tDisplay('onboarding.option_general_desc')} 
                    />
                  </AnimatedPressable>

                  <AnimatedPressable 
                    style={[styles.choiceCard, buttonStyles.bg, buttonStyles.accentBorder, animatedStyles.optionChal]}
                    onPress={() => animateWellnessPath('challenges')}
                    hitSlop={styles.hitSlop}
                    pressRetentionOffset={styles.pressRetention}
                  >
                    {/* Single smooth overlay for challenges wellness option */}
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        StyleSheet.absoluteFill,
                        {
                          borderRadius: 12,
                          backgroundColor: buttonStyles.overlay.nodeBase,
                          opacity: optionChalAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] })
                        }
                      ]}
                    />
                    <ChoiceOption 
                      icon="shield-checkmark" 
                      title={tDisplay('onboarding.option_challenges_title')} 
                      description={tDisplay('onboarding.option_challenges_desc')} 
                    />
                  </AnimatedPressable>
                </>
              )}

              {(primary === 'productivity' || showProductivityCard) && (
                <AnimatedPressable 
                  style={[
                    styles.choiceCard,
                    buttonStyles.bg,
                    // Secondary (Amanda) card should use the accent outline as well
                    buttonStyles.accentBorder,
          animatedStyles.amanda
                  ]}
                  onPress={() => animateSelection('productivity', 'amanda')}
                  hitSlop={styles.hitSlop}
                  pressRetentionOffset={styles.pressRetention}
                >
                  {/* Single smooth overlay for productvity step2 card */}
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      StyleSheet.absoluteFill,
                      {
                        borderRadius: 12,
                        backgroundColor: buttonStyles.overlay.nodeBase,
            opacity: amandaAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] })
                      }
                    ]}
                  />
                  <ChoiceOption 
                    icon="speedometer" 
                      title={tDisplay('onboarding.option_productivity_secondary_title')} 
                      description={tDisplay('onboarding.option_productivity_secondary_desc')} 
                  />
                </AnimatedPressable>
              )}

              <View style={styles.buttonRowContainer}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <AnimatedPressable
                    onPress={back}
                    style={[
                      styles.backButton,
                      buttonStyles.bg,
                      buttonStyles.accentBorder
                    ]}
                    hitSlop={styles.hitSlop}
                    pressRetentionOffset={styles.pressRetention}
                  >
                    {/* Match Next/Signup overlay layers so Back uses identical colors */}
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        StyleSheet.absoluteFill,
                        {
                          borderRadius: 12,
                          backgroundColor: buttonStyles.overlay.disabled,
                          opacity: 0, // Back is always enabled here; keep disabled layer hidden
                        }
                      ]}
                    />
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        StyleSheet.absoluteFill,
                        {
                          borderRadius: 12,
                          backgroundColor: buttonStyles.overlay.buttonBase,
                          opacity: 1
                        }
                      ]}
                    />
                    <Text style={[styles.nextTextLarge, buttonStyles.enabledText]}>
                      {tDisplay('onboarding.back')}
                    </Text>
                  </AnimatedPressable>

                  <AnimatedPressable 
                    onPress={next}
                    onPressIn={onSignupPressIn}
                    onPressOut={onSignupPressOut}
                    disabled={!isNextEnabled || isExporting}
                    style={[
                      styles.signupButton, 
                      buttonStyles.bg, 
                      isNextEnabled && !isExporting ? buttonStyles.accentBorder : buttonStyles.greyBorder, 
                      animatedStyles.signupBtnPress
                    ]}
                    hitSlop={styles.hitSlop}
                    pressRetentionOffset={styles.pressRetention}
                  >
                    {/* Overlay fills removed to prevent 'node popping' effect; keep text opacity animation only */}
                    {/* Smooth color crossfade overlays for Signup */}
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        StyleSheet.absoluteFill,
                        {
                          borderRadius: 12,
                          backgroundColor: buttonStyles.overlay.disabled,
                          opacity: enabledAnimSignup.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.5, 0] })
                        }
                      ]}
                    />
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        StyleSheet.absoluteFill,
                        {
                          borderRadius: 12,
                          backgroundColor: buttonStyles.overlay.buttonBase,
                          opacity: enabledAnimSignup.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.5, 1] })
                        }
                      ]}
                    />
                    <Animated.Text 
                        style={[
                          styles.nextTextLarge, 
                          { 
                            position: 'absolute', left: 0, right: 0, textAlign: 'center',
                            opacity: enabledAnimSignup.interpolate({ inputRange: [0, 1], outputRange: [1, 0] })
                          }, 
                          buttonStyles.disabledText
                        ]}
                      >
                        {tDisplay('onboarding.signup')}
                      </Animated.Text>
                      <Animated.Text 
                        style={[
                          styles.nextTextLarge, 
                          { position: 'absolute', left: 0, right: 0, textAlign: 'center', opacity: enabledAnimSignup }, 
                          buttonStyles.enabledText
                        ]}
                      >
                        {tDisplay('onboarding.signup')}
                      </Animated.Text>
                  </AnimatedPressable>
                </View>
              </View>

              <View style={styles.noteContainer}>
                <Text style={styles.noteText}>
                  {tDisplay('onboarding.modules_note')}
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>
      </View>
  </View>
  </Providers>
  );
}

const getStyles = (isDark: boolean) => StyleSheet.create({
  root: { 
    flex: 1, 
    backgroundColor: isDark ? '#0A1E1C' : '#FFFFFF' 
  },
  
  // Welcome screen styles
  welcomeTitle: { 
    fontSize: 28, 
    color: '#4dccc1', 
    fontWeight: '700', 
    textAlign: 'center' 
  },
  welcomeSubtitle: { 
    fontSize: 16, 
    color: '#4dccc1', 
    marginTop: 8, 
    textAlign: 'center' 
  },
  
  // Step heading
  stepHeading: { 
    textAlign: 'center', 
    color: '#4dccc1', 
    fontSize: 14, 
    lineHeight: 20, 
    marginBottom: 10,
    marginTop: -45 // Negative margin to bring closer to logo
  },
  
  // Choice cards
  choiceCard: { 
    borderWidth: 1, 
    borderRadius: 12, 
    padding: 12, 
    marginBottom: 12, 
    overflow: 'hidden', 
    width: '92%', 
    maxWidth: 680, 
    alignSelf: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  
  choiceContainer: { 
    flexDirection: 'row', 
    alignItems: 'flex-start', 
    padding: 14, 
    borderRadius: 10, 
    marginBottom: 10, 
    backgroundColor: 'transparent' 
  },
  
  choiceIcon: { 
    width: 36, 
    height: 36, 
    borderRadius: 8, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 12 
  },
  
  choiceTextWrap: { flex: 1 },
  
  choiceTitle: { 
    fontWeight: '700', 
    fontSize: 16, 
    marginBottom: 6, 
    color: '#4dccc1' 
  },
  
  choiceDescription: { 
    color: '#4dccc1', 
    fontSize: 13, 
    lineHeight: 18 
  },
  
  // Button containers
  buttonContainer: { 
    width: '92%', 
    maxWidth: 680, 
    alignSelf: 'center', 
    marginTop: 6, 
    alignItems: 'center', 
    marginBottom: 4 
  },
  
  buttonRowContainer: { 
    width: '92%', 
    maxWidth: 680, 
    marginTop: 8 
  },
  
  // Buttons
  nextButtonLarge: {
  width: '100%',
  paddingVertical: 14,
  minHeight: 52,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  
  backButton: {
  flex: 1,
  paddingVertical: 14,
  minHeight: 52,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  signupButton: {
  flex: 1,
  paddingVertical: 14,
  minHeight: 52,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  nextTextLarge: {
    fontWeight: '700',
    fontSize: 16,
  },
  
  // Note section
  noteContainer: { 
    width: '92%', 
    maxWidth: 680, 
    alignSelf: 'center', 
    marginTop: 12 
  },
  
  noteText: { 
    color: '#4dccc1', 
    fontSize: 12, 
    textAlign: 'center', 
    opacity: 0.8 
  },
  
  // Top buttons
  topButtonsContainer: {
    position: 'absolute',
    top: 45,
  left: 25,
    zIndex: 1000,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 4,
  },
  
  themeButton: {
    backgroundColor: isDark ? 'rgba(14, 46, 44, 0.85)' : 'rgba(255, 255, 255, 0.9)',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 0.7,
  borderColor: '#4DCCC1',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    alignItems: 'center',
  },
  
  languageButton: {
    backgroundColor: isDark ? 'rgba(14, 46, 44, 0.85)' : 'rgba(255, 255, 255, 0.9)',
  width: 64,
    height: 44,
    borderRadius: 22,
    borderWidth: 0.7,
    borderColor: '#4DCCC1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },

  languageButtonActive: {
    backgroundColor: isDark ? 'rgba(14, 46, 44, 0.95)' : 'rgba(255, 255, 255, 0.95)',
  },

  languageDropdownContainer: {
    position: 'absolute',
    top: 46,
    left: 0,
    width: 160,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 2.5,
  },

  languageDropdown: {
    backgroundColor: isDark ? 'rgba(14, 46, 44, 0.98)' : 'rgba(255, 255, 255, 0.98)',
    borderRadius: 22,
    borderWidth: 0.7,
    borderColor: '#4DCCC1',
    overflow: 'hidden',
  width: 160,
    zIndex: 1000,
  },

  languageOption: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },

  languageOptionDivider: {
    borderBottomWidth: 0.7,
    borderBottomColor: '#4dccc1',
  },

  languageOptionActive: {
    backgroundColor: 'rgba(77, 205, 194, 0.15)'
  },

  languageOptionText: {
  color: '#4DCCC1',
  fontSize: 14,
  lineHeight: 16,
  },

  languageOptionTextActive: {
    fontWeight: '600'
  },

  // dropdownSeparator removed; option-level dividers used instead
  
  dropdownBackdrop: { 
    position: 'absolute', 
    top: -40, 
    left: -20, 
    right: -20, 
    bottom: -1000, 
    backgroundColor: 'transparent' 
  },
  
  // Interaction areas
  hitSlop: { 
    top: 16, 
    bottom: 16, 
    left: 16, 
    right: 16 
  },
  
  pressRetention: { 
    top: 12, 
    bottom: 12, 
    left: 12, 
    right: 12 
  },
});