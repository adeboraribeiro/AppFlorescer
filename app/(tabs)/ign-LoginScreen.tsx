
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
// Plan exporter is intentionally imported here — login screen needs to read
// exported plans when arriving from onboarding.
import Providers from '@/components/Providers';
import { getLoginCache, saveLoginCache } from '../../components/loginCache';
import { getSelectedFeatureIds, readSelectedPlans } from '../../components/planexport';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useUser } from '../../contexts/UserContext';
import { supabase } from '../../lib/supabase';
// Use the centralized in-memory login cache so inputs persist across navigation
// while the app is running (keeps values when the user opens onboarding and returns).

// Ensure all Text components default to the requested color
(Text as any).defaultProps = (Text as any).defaultProps || {};
(Text as any).defaultProps.style = [{ color: '#4DCCC1' }, (Text as any).defaultProps.style];

const { width } = Dimensions.get('window');
// Match container horizontal padding (see styles.container / contentWrapper)
const HORIZONTAL_PADDING = 30; // reduced container padding on each side
// Page width should match the container inner width so the inner form fits
const PAGE_WIDTH = width - HORIZONTAL_PADDING * 2;
// Animated wrapper for Ionicons so we can rotate the chevron smoothly
const AnimatedIonicons = Animated.createAnimatedComponent(Ionicons);
// Loading overlay component
const LoadingOverlay = ({ loadingText, isDark, opacity = 1 }: { loadingText?: string, isDark: boolean, opacity?: number | Animated.AnimatedInterpolation<number> }) => {
  const styles = getThemedStyles(isDark);
  return (
    <Animated.View style={[styles.loadingOverlay, { opacity, backgroundColor: isDark ? '#0A1E1C' : '#FFFFFF' }]}>
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#80E6D9" />
        {loadingText && <Text style={styles.loadingText}>{loadingText}</Text>}
      </View>
    </Animated.View>
  );
};

export default function LoginScreen() {
  const { t, i18n } = useTranslation();
  // Hardcoded single-word loading translations for tighter control during
  // the quick language-change overlay. Keys match language codes used in app.
  const LOADING_WORDS: Record<string, string> = {
    'en': 'Loading...',
    'es': 'Cargando...',
    'pt-BR': 'Carregando...'
  };
  const params = useLocalSearchParams();
  const { theme, toggleTheme } = useTheme();
  const isDarkMode = theme === 'dark';
  const [isSignup, setIsSignup] = useState(() => {
    try {
      const mode = (params as any)?.mode;
      return mode === 'login' ? false : true;
    } catch (e) { return true; }
  });
  const [loading, setLoading] = useState(false);
  const { showNotification } = useNotification();
  const fromOnboarding = ((params as any)?.from) === 'onboarding';
  const contentOpacity = useRef(new Animated.Value(fromOnboarding ? 0 : 1)).current;
  // Input refs for focus management (separate                                                                                                                                                                                                                                                                                                                                                                                                     refs per mode so both panes
  // can stay mounted without refs clobbering each other)
  // Signup refs
  const nameInputSignup = useRef<TextInput>(null);
  const lastNameInputSignup = useRef<TextInput>(null);
  const birthdateInputSignup = useRef<TextInput>(null);
  const emailInputSignup = useRef<TextInput>(null);
  const usernameInputSignup = useRef<TextInput>(null);
  const passwordInputSignup = useRef<TextInput>(null);
  const confirmPasswordInputSignup = useRef<TextInput>(null);
  // Login refs
  const emailInputLogin = useRef<TextInput>(null);
  const passwordInputLogin = useRef<TextInput>(null);
  // Helper to blur all known input refs so caret/focus is removed
  const blurAllInputs = () => {
    try {
      const refs = [
        nameInputSignup,
        lastNameInputSignup,
        birthdateInputSignup,
        emailInputSignup,
        usernameInputSignup,
        passwordInputSignup,
        confirmPasswordInputSignup,
        emailInputLogin,
        passwordInputLogin,
      ];
      refs.forEach((r) => {
        try {
          if (r && (r as any).current && typeof (r as any).current.blur === 'function') {
            (r as any).current.blur();
          }
        } catch (e) {}
      });
    } catch (e) {}
  };
  const [formData, setFormData] = useState({
  email_login: '',
  email_signup: '',
  password_login: '',
  password_signup: '',
    name: '',
    lastName: '',
    birthdate: '',
    username: '',
    confirmPassword: '',
  });
  // Local visible values for inputs. These update immediately for the user, but
  // are only committed into `formData` after DEBOUNCE_MS of inactivity or on submit.
  const [localValues, setLocalValues] = useState({
  email_login: '',
  email_signup: '',
  password_login: '',
  password_signup: '',
    name: '',
    lastName: '',
    birthdate: '',
    username: '',
    confirmPassword: '',
  });
  // Restore cached inputs (in-memory) for the current mode only so login
  // inputs are not shown in signup and vice-versa.
  useEffect(() => {
    try {
      // If a programmatic page toggle is in progress and we've already
      // collected a pending cache to apply after the scroll, do not restore
      // now — it will be applied when the scroll finishes to avoid visual
      // clearing during the animation.
      if (pendingCacheRef.current) return;
      const cached = getLoginCache(isSignup ? 'signup' : 'login');
  if (cached?.localValues) setLocalValues(prev => ({ ...cached.localValues, ...prev }));
  if (cached?.formData) setFormData(prev => ({ ...cached.formData, ...prev }));
    } catch (e) {}
  }, [isSignup]);

  // If we returned from onboarding (router param ?from=onboarding) ensure
  // we restore the cached inputs for the current mode. Some navigation
  // flows return with this param and the component may remount without the
  // isSignup switching; explicitly listen for the param so inputs aren't
  // unexpectedly cleared when the user re-selects plans.
  useEffect(() => {
    try {
      const from = (params as any)?.from;
        if (from === 'onboarding') {
      // Same guard as above: if a programmatic page toggle is in-flight
      // the pending cache will be applied later; skip immediate restore.
      if (pendingCacheRef.current) return;
      const cached = getLoginCache(isSignup ? 'signup' : 'login');
      if (cached?.localValues) setLocalValues(prev => ({ ...cached.localValues, ...prev }));
      if (cached?.formData) setFormData(prev => ({ ...cached.formData, ...prev }));
        }
    } catch (e) {}
  }, [params?.from, isSignup]);
  // Mirror localValues in a ref so debounce callbacks always read the latest visible value
  const localValuesRef = useRef(localValues);
  useEffect(() => { localValuesRef.current = localValues; }, [localValues]);
  // Timers for committing localValues into formData
  const commitTimersRef = useRef<{[key:string]: ReturnType<typeof setTimeout> | null}>({
    name: null,
    lastName: null,
    birthdate: null,
    email: null,
    username: null,
    password: null,
    confirmPassword: null,
  });
  // Track when timers were started so we can cap the "pending" UI
  const commitTimersStartRef = useRef<{[key:string]: number | null}>({
    name: null,
    lastName: null,
    birthdate: null,
    email: null,
    username: null,
    password: null,
    confirmPassword: null,
  });

  // Animated ellipses tick (used to show cycling '.', '..', '...')
  const [ellipsesTick, setEllipsesTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setEllipsesTick(t => (t + 1) % 3), 200);
    return () => clearInterval(id);
  }, []);

  const isFieldPending = (field: string) => {
    try {
      const PENDING_GRACE_MS = 300; // allow a short grace beyond debounce
      const now = Date.now();
      // If a live timer exists, it's pending
      if (commitTimersRef.current[field]) return true;
      const cStart = commitTimersStartRef.current[field];
      if (cStart) {
        const allowed = getDebounceForField(field) + PENDING_GRACE_MS;
        if (now - cStart <= allowed) return true;
        // expired, clear start
        commitTimersStartRef.current[field] = null;
      }
      if (validationTimersRef.current[field]) return true;
      const vStart = validationTimersStartRef.current[field];
      if (vStart) {
        const allowed = getDebounceForField(field) + PENDING_GRACE_MS;
        if (now - vStart <= allowed) return true;
        validationTimersStartRef.current[field] = null;
      }
      return false;
    } catch (e) { return false; }
  };

  // Track which fields the user has interacted with to avoid showing "required"
  // validation errors for untouched fields (fixes email being flagged when
  // other fields are edited).
  // Track which fields the user has interacted with per-mode so touching
  // login fields doesn't mark signup fields as touched and vice-versa.
  const touchedRef = useRef<{ login: {[k:string]: boolean}, signup: {[k:string]: boolean} }>({
    login: {
      email: false,
      password: false,
    },
    signup: {
      name: false,
      lastName: false,
      birthdate: false,
      email: false,
      username: false,
      password: false,
      confirmPassword: false,
    }
  });

  const markTouched = (field: string, mode?: 'login'|'signup') => {
    try {
      const m = mode ?? (isSignup ? 'signup' : 'login');
      const map = touchedRef.current[m] as any;
      if (map) map[field] = true;
    } catch (e) {}
  };

  const scheduleCommit = (field: string, value: string) => {
    // If the user cleared the field, commit immediately (no debounce)
    if (value === '') {
      commitImmediately(field, value);
      return;
    }

    try {
      const t = commitTimersRef.current[field];
      if (t) {
        clearTimeout(t as any);
        commitTimersRef.current[field] = null;
      }
    } catch (e) {}

    commitTimersRef.current[field] = setTimeout(() => {
      commitTimersRef.current[field] = null;
      commitTimersStartRef.current[field] = null;
      // Map generic fields to per-mode storage keys when necessary
      const visibleKey = (field === 'email') ? (isSignup ? 'email_signup' : 'email_login') : (field === 'password' ? (isSignup ? 'password_signup' : 'password_login') : field);
      const latest = (localValuesRef.current as any)[visibleKey] ?? value;
      setFormData(prev => ({ ...prev, [visibleKey]: latest }));
      // run validation for the committed value using the latest visible value
      validateFieldNow(field, latest as string);
    }, getDebounceForField(field));
    commitTimersStartRef.current[field] = Date.now();

  // Start a lightweight client-only check immediately so the UI shows
  // a pending state while the heavier validation runs after debounce.
  runImmediateClientChecks(field, value);
  };

  const commitImmediately = (field: string, value: string) => {
    try {
      const t = commitTimersRef.current[field];
      if (t) {
        clearTimeout(t as any);
        commitTimersRef.current[field] = null;
      }
    } catch (e) {}
  // clear start timestamp if present
  try { commitTimersStartRef.current[field] = null; } catch (e) {}
  // Map generic fields to per-mode storage keys when necessary
  const visibleKey = (field === 'email') ? (isSignup ? 'email_signup' : 'email_login') : (field === 'password' ? (isSignup ? 'password_signup' : 'password_login') : field);
  const latest = (localValuesRef.current as any)[visibleKey] ?? value;
  // If the visible value equals the already-committed value, avoid
  // starting a new validation run — this prevents a new check when the
  // user pressed Next/blur but didn't change the input.
  const alreadyCommitted = (formData as any)[visibleKey];
  setFormData(prev => ({ ...prev, [visibleKey]: latest }));
  if (latest === alreadyCommitted) {
    // Nothing changed; don't trigger validation now. If a validation is
    // already scheduled/running it will proceed as normal.
    return;
  }
  validateFieldNow(field, latest as string);
  };

  const flushAllPendingCommits = () => {
    // clear timers and commit localValues into formData
    Object.keys(commitTimersRef.current).forEach((k) => {
      try {
        const t = commitTimersRef.current[k];
        if (t) clearTimeout(t as any);
      } catch (e) {}
  commitTimersRef.current[k] = null;
  commitTimersStartRef.current[k] = null;
    });
  // Use the ref to ensure we commit the latest visible values
  setFormData(prev => ({ ...prev, ...localValuesRef.current }));
  };
  const [usernameAvailable, setUsernameAvailable] = useState(true);
  const [checkingUsername, setCheckingUsername] = useState(false);

  // Background username availability check helpers
  const usernameCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const usernameCheckSeqRef = useRef(0);
  const usernameLastCheckedRef = useRef<string | null>(null);
  // Email availability check (signup only) - mirrors username check flow
  const [emailAvailable, setEmailAvailable] = useState(true);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const emailCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emailCheckSeqRef = useRef(0);
  const emailLastCheckedRef = useRef<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showVerification, setShowVerification] = useState(false);

  // Animated values for slide/fade transitions.
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  // New: shiftAnim for keyboard upward movement.
  const shiftAnim = useRef(new Animated.Value(0)).current;
  // Scroll ref for dual-mounted swipe between signup/login panes
  const scrollRef = useRef<ScrollView | null>(null);
  // Guard flag when we programmatically call scrollTo so user gestures don't fight it
  const isProgrammaticScrollRef = useRef(false);
  // Desired page index when programmatic scroll is in-flight (0 = signup, 1 = login)
  const desiredPageRef = useRef<number | null>(null);
  // Pending cached inputs to apply after programmatic page scroll finishes
  const pendingCacheRef = useRef<{ localValues?: any; formData?: any } | null>(null);
  // Flag to skip the next automatic cache restore (used after we applied pendingCache)
  const skipRestoreRef = useRef(false);
  // Timeout ref used to keep the programmatic guard active briefly on initial mount
  // (prevents a quick flip when coming from onboarding which may cause routing races)
  const initGuardTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isConfirmPasswordFocused, setIsConfirmPasswordFocused] = useState(false);
  // Track when the main password field is focused so we can nudge it a bit higher
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  const { signIn, signUp, signInWithProvider } = useAuth();
  const [importedPlans, setImportedPlans] = useState<Array<{ title: string; subtitle?: string }> | null>(null);
  const [importedPlansLoaded, setImportedPlansLoaded] = useState(false);
  const [plansInvalid, setPlansInvalid] = useState(false);

  // Use planexport's helper to read selected plans (imported above)
  
  const [, forceUpdate] = useState({});
  useEffect(() => {
    // Load previously exported plans only when we explicitly arrived from
    // onboarding. This avoids pulling planexport into the login bundle and
    // prevents default runtime bundling/exports when the user didn't come
    // from onboarding.
    (async () => {
      try {
        if (fromOnboarding) {
          const plans = await readSelectedPlans();
          if (plans && plans.length > 0) setImportedPlans(plans as any);
        }
      } catch (e) {
        // ignore
      } finally {
        setImportedPlansLoaded(true);
      }
    })();

    const timer = setInterval(() => {
      forceUpdate({});
    }, 1000);
    return () => clearInterval(timer);
    // We intentionally re-run when the active language changes so the
    // plan UI can reflect translations or reloaded localized plan data.
  }, [i18n.language, fromOnboarding]);

  useEffect(() => {
    const keyboardDidShowSub = Keyboard.addListener('keyboardDidShow', (event) => {
      const { height } = event.endCoordinates;
      // Base target: confirm password gets a larger base offset (-height/2)
      // other fields use -height/3. We previously scaled everything to 70%.
      // Now nudge password slightly higher only in signup; use a spring so
      // transitions between focus changes interpolate from the current value
      // instead of restarting abruptly.
      const base = isConfirmPasswordFocused ? -height / 2 : -height / 3;
      let scale = 0.7;
      if (isPasswordFocused && !isConfirmPasswordFocused && isSignup) {
        scale *= 1.2;
      }
      Animated.spring(shiftAnim, {
        toValue: base * scale,
        tension: 80,
        friction: 12,
        useNativeDriver: true,
      }).start();
    });
    const keyboardDidHideSub = Keyboard.addListener('keyboardDidHide', () => {
      // Spring back to zero for a smooth hide as well
      Animated.spring(shiftAnim, {
        toValue: 0,
        tension: 80,
        friction: 12,
        useNativeDriver: true,
      }).start();
  // Ensure any lingering input caret is blurred when keyboard hides
  try { blurAllInputs(); } catch (e) {}
    });
    return () => {
      keyboardDidShowSub.remove();
      keyboardDidHideSub.remove();
    };
  }, [shiftAnim, isConfirmPasswordFocused, isPasswordFocused]);

  const checkUsername = async (username: string) => {
    if (!username) {
      setUsernameAvailable(false);
      return false;
    }
    setCheckingUsername(true);
    try {
      // Use secure RPC function to check username existence instead of
      // querying the profiles table directly (avoids row-level policy leaks)
      const { data, error } = await supabase.rpc('check_username_exists', { p_username: username });

      if (error) {
        // RPC failure - treat as unavailable to be conservative
        console.error('RPC check_username_exists error:', error);
        setUsernameAvailable(false);
        return false;
      }

      // RPC returns a truthy value when username exists. Interpret accordingly.
      const exists = !!data;
      const available = !exists;
      setUsernameAvailable(available);
      return available;
    } catch (err) {
      console.error('Error checking username via RPC:', err);
      setUsernameAvailable(false);
      return false;
    } finally {
      setCheckingUsername(false);
    }
  };

  const checkEmail = async (email: string) => {
    if (!email) {
      setEmailAvailable(false);
      return false;
    }
    setCheckingEmail(true);
    try {
      const { data, error } = await supabase.rpc('check_email_exists', { p_email: email });
      if (error) {
        // If the RPC function isn't found in the schema cache (PGRST202)
        // it means the DB-side function hasn't been created. Don't treat
        // that as "email exists" — warn the developer and allow signups
        // until the function is installed. This avoids blocking all signups
        // when the RPC is missing.
        if ((error as any)?.code === 'PGRST202') {
          console.warn('check_email_exists RPC not found (PGRST202). Create the function in your DB to enable secure email checks.');
          // optimistic: allow until RPC is installed
          setEmailAvailable(true);
          return true;
        }

        console.error('RPC check_email_exists error:', error);
        setEmailAvailable(false);
        return false;
      }
      const exists = !!data;
      const available = !exists;
      setEmailAvailable(available);
      return available;
    } catch (err) {
      console.error('Error checking email via RPC:', err);
      // On unexpected errors do not block signup; assume available so users
      // can proceed, but surface console guidance for the developer.
      setEmailAvailable(true);
      return true;
    } finally {
      setCheckingEmail(false);
    }
  };

  // Validation debounce refs and helpers
  const validationTimersRef = useRef<{[key:string]: ReturnType<typeof setTimeout> | null}>({
    name: null,
    lastName: null,
    birthdate: null,
    email: null,
    username: null,
    password: null,
    confirmPassword: null,
  });
  const validationTimersStartRef = useRef<{[key:string]: number | null}>({
    name: null,
    lastName: null,
    birthdate: null,
    email: null,
    username: null,
    password: null,
    confirmPassword: null,
  });
  const DEBOUNCE_MS = 1700; // default debounce for most fields (ms)
  const SNAPPY_DEBOUNCE_MS = 500; // snappier debounce for username/password checks

  // Per-field debounce tuning (shorter for simple client-only checks)
  const getDebounceForField = (field: string) => {
    switch (field) {
      case 'name':
      case 'lastName':
        return 300; // very quick client checks
      case 'birthdate':
        return 500; // needs some typing but still quick
      case 'email':
        return 700; // allow user to finish typing local part
      case 'username':
      case 'password':
      case 'confirmPassword':
        return SNAPPY_DEBOUNCE_MS; // server checks or stronger validation
      default:
        return DEBOUNCE_MS;
    }
  };

  // Run lightweight client-only checks immediately so the UI can show a
  // "loading/pending" state while the heavier debounced checks run.
  const runImmediateClientChecks = (field: string, value: string) => {
    try {
      // Mark validation start so isFieldPending shows immediately.
      validationTimersStartRef.current[field] = Date.now();

      // For very simple fields we don't want to show a lasting pending
      // indicator; schedule a small expiry so UI doesn't remain blocked.
      const QUICK_EXPIRE = field === 'name' || field === 'lastName' ? 600 : 900;
      setTimeout(() => {
        // Only clear the synthetic start if no real validation timer is running
        if (!validationTimersRef.current[field]) {
          validationTimersStartRef.current[field] = null;
        }
      }, QUICK_EXPIRE);

      // We purposely avoid setting persistent fieldErrors here so the
      // UI doesn't display an error while pending — final errors are
      // surfaced by validateFieldNow after debounce.
    } catch (e) {
      // ignore
    }
  };

  // Debounced validation for all fields: only run after 1s of no changes, even onBlur
  const validateFieldNow = (field: string, value?: string) => {
    // Always clear any pending timer for this field
    try {
      const t = validationTimersRef.current[field];
      if (t) {
        clearTimeout(t as any);
        validationTimersRef.current[field] = null;
      }
    } catch (e) {}

  validationTimersRef.current[field] = setTimeout(async () => {
      switch (field) {
        case 'name': {
          const v = typeof value === 'string' ? value : formData.name;
          const trimmed = v.trim();
          setFieldErrors(prev => ({ ...prev, name: !(trimmed.length >= 2 && trimmed.length <= 15 && /^[A-Za-zÀ-ÖØ-öø-ÿ\s]+$/.test(trimmed)) }));
          break;
        }
        case 'lastName': {
          const v = typeof value === 'string' ? value : formData.lastName;
          const trimmed = v.trim();
          setFieldErrors(prev => ({ ...prev, lastName: trimmed.length > 0 ? !(trimmed.length >= 2 && trimmed.length <= 15 && /^[A-Za-zÀ-ÖØ-öø-ÿ\s]+$/.test(trimmed)) : false }));
          break;
        }
        case 'birthdate': {
          const v = typeof value === 'string' ? value : formData.birthdate;
          const reason = getBirthdateErrorReason(v);
          setFieldErrors(prev => ({ ...prev, birthdate: !!reason }));
          setBirthdateErrorReason(reason);
          break;
        }
        case 'email': {
          const v = typeof value === 'string' ? value : (isSignup ? formData.email_signup : formData.email_login);
          // Only mark the email field as required if the user has interacted
          // with it. This prevents other fields' validation from incorrectly
          // flagging email as empty when untouched.
          if (!v) {
            const touched = isSignup ? touchedRef.current.signup.email : touchedRef.current.login.email;
            if (touched) {
              setFieldErrors(prev => ({ ...prev, email: true }));
            } else {
              // leave email as not errored when untouched
              setFieldErrors(prev => ({ ...prev, email: false }));
            }
          } else {
            // Different validation depending on signup vs login:
            // - Signup: require a valid email address.
            // - Login: accept either a username (>=3 chars) or a valid email.
            if (isSignup) {
              setFieldErrors(prev => ({ ...prev, email: !isValidEmail(v) }));
            } else {
              const isShortUsername = v.length < 3;
              const valid = isValidEmail(v) || !isShortUsername;
              setFieldErrors(prev => ({ ...prev, email: !valid }));
            }
          }
          break;
        }
        case 'username': {
          const u = typeof value === 'string' ? value : formData.username;
          if (!u) {
            setFieldErrors(prev => ({ ...prev, username: true }));
            break;
          }
          if (!isValidUsername(u)) {
            setFieldErrors(prev => ({ ...prev, username: true }));
            break;
          }
          setCheckingUsername(true);
          try {
            const available = await checkUsername(u);
            setFieldErrors(prev => ({ ...prev, username: !available }));
          } catch (e) {
            setFieldErrors(prev => ({ ...prev, username: false }));
          } finally {
            setCheckingUsername(false);
          }
          break;
        }
        case 'password': {
          const v = typeof value === 'string' ? value : (isSignup ? formData.password_signup : formData.password_login);
          // For signup we enforce password strength; for login we only
          // consider password 'errored' when it's empty (keeps behavior
          // consistent with handleSubmit which requires a non-empty password)
          if (isSignup) {
            setFieldErrors(prev => ({ ...prev, password: !isValidPassword(v) }));
          } else {
            if (!v) {
              const touched = isSignup ? touchedRef.current.signup.password : touchedRef.current.login.password;
              if (touched) {
                setFieldErrors(prev => ({ ...prev, password: true }));
              } else {
                setFieldErrors(prev => ({ ...prev, password: false }));
              }
            } else {
              // non-empty password is acceptable for login
              setFieldErrors(prev => ({ ...prev, password: false }));
            }
          }
          break;
        }
        case 'confirmPassword': {
          const v = typeof value === 'string' ? value : formData.confirmPassword;
          setFieldErrors(prev => ({ ...prev, confirmPassword: !(v && v === (isSignup ? formData.password_signup : formData.password_login)) }));
          break;
        }
        default:
          break;
      }
    validationTimersRef.current[field] = null;
    validationTimersStartRef.current[field] = null;
  }, getDebounceForField(field));
  validationTimersStartRef.current[field] = Date.now();
  };

  const isValidBirthDate = (date: string): boolean => {
    // Check if the date matches DD/MM/YYYY format
    const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    if (!dateRegex.test(date)) return false;
    
    const [day, month, year] = date.split('/').map(Number);

    // Check minimum year (1925)
    if (year < 1925) return false;
    
    // Create a Date object and verify the date is valid
    const dateObj = new Date(year, month - 1, day);
    if (!(dateObj.getDate() === day &&
        dateObj.getMonth() === month - 1 &&
        dateObj.getFullYear() === year)) {
      return false;
    }

    // Get current date
    const currentDate = new Date();
    
    // Calculate age
    let age = currentDate.getFullYear() - dateObj.getFullYear();
    const monthDiff = currentDate.getMonth() - dateObj.getMonth();
    const dayDiff = currentDate.getDate() - dateObj.getDate();
    
    // Adjust age if birth month hasn't occurred this year
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      age--;
    }
    
    // Check if user is at least 13 years old
    return age >= 13;
  };

  // Return a specific birthdate error reason key (matching i18n keys) or null when valid/empty
  const getBirthdateErrorReason = (date: string): string | null => {
    if (!date) return null;
    const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    if (!dateRegex.test(date)) return 'invalid_birthdate';
    const [day, month, year] = date.split('/').map(Number);
    if (year < 1925) return 'invalid_birthdate_twentyfive';
    const dateObj = new Date(year, month - 1, day);
    if (!(dateObj.getDate() === day && dateObj.getMonth() === month - 1 && dateObj.getFullYear() === year)) return 'invalid_birthdate';

    const currentDate = new Date();
    let age = currentDate.getFullYear() - dateObj.getFullYear();
    const monthDiff = currentDate.getMonth() - dateObj.getMonth();
    const dayDiff = currentDate.getDate() - dateObj.getDate();
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) age--;
    if (age < 13) return 'invalid_birthdate_age';
    return null;
  };

  const [fieldErrors, setFieldErrors] = useState({
    name: false,
    username: false,
    birthdate: false,
    email: false,
    password: false,
    confirmPassword: false
  });
  // Specific reason for birthdate errors; used to keep age/format/year messages instead of 'required'
  const [birthdateErrorReason, setBirthdateErrorReason] = useState<string | null>(null);

  // Helper to clear validation UI and timers so fields appear neutral until user interaction
  // Note: automatic validation clearing was removed per UX request so
  // validation state persists unless explicitly changed by submit/blur logic.
  const handleSubmit = async () => {
    if (loading) return;

  // Close the keyboard immediately when submitting so fields won't remain
  // focused (fixes cases where taps don't register or keyboard hides UI)
  Keyboard.dismiss();

  // Commit any pending input commits so programmatic/pasted values are
  // available immediately. We also create a committed snapshot and use
  // that snapshot for all validation/submission logic so we don't rely on
  // setState timing.
  flushAllPendingCommits();
    const committedForm = { ...formData, ...localValuesRef.current };

    // For login form, check if email/username and password are provided
    if (!isSignup) {
      // Mark login fields as touched so per-field validation UI appears
      try {
        touchedRef.current.login.email = true;
        touchedRef.current.login.password = true;
      } catch (e) {}

      const emailOrUsername = (committedForm.email_login || '').trim();
      // For login, we only check if the field has at least 3 characters
      const errors = {
        email: emailOrUsername.length < 3,
        password: !committedForm.password_login
      };
      setFieldErrors(prev => ({ ...prev, ...errors }));

      // Keep existing notification behavior but do not short-circuit
      // before setting all field errors — allow both error flags to be set
      if (errors.email) {
        showNotification(emailOrUsername.length === 0 ?
          t('auth.errors.login_email_required') :
          t('auth.errors.username_too_short'), 'error');
        return;
      }
      if (errors.password) {
        showNotification(t('auth.errors.login_password_required'), 'error');
        return;
      }
    }

    if (isSignup) {
      // Check plans but treat the plan notification as low priority.
      // If plans are missing we mark the UI invalid (red) but we still
      // validate all other fields first. Only show the "no plan"
      // notification if it's the only failing validation.
      let plansMissing = false;
      try {
        // Only consider plans when we explicitly came from onboarding.
        if (fromOnboarding) {
          const plans = await readSelectedPlans();
          if (!plans || plans.length === 0) {
            plansMissing = true;
            setPlansInvalid(true);
          } else {
            setPlansInvalid(false);
          }
        } else {
          // Not from onboarding: don't auto-load exported plans
          plansMissing = false;
          setPlansInvalid(false);
        }
      } catch (e) {
        // If reading plans failed, mark as missing but don't immediately notify
        plansMissing = true;
        setPlansInvalid(true);
      }

      // Mark signup fields as touched so per-field validation UI appears
      try {
        const s = touchedRef.current.signup;
        s.name = true; s.lastName = true; s.birthdate = true; s.email = true; s.username = true; s.password = true; s.confirmPassword = true;
      } catch (e) {}

      // Reset all field errors using the committed snapshot
      const errors = {
        name: !committedForm.name,
        username: !committedForm.username,
        // preserve specific birthdate reason if set; mark as required only when empty and no specific reason
        birthdate: (!!birthdateErrorReason) ? true : !committedForm.birthdate,
        email: !committedForm.email_signup,
        password: !committedForm.password_signup,
        confirmPassword: !committedForm.confirmPassword
      };

      setFieldErrors(errors);

      // If there are other field errors, surface those first and abort.
      if (Object.values(errors).some(error => error)) {
        showNotification(t('auth.errors.required_fields'), 'error');
        return;
      }

      // If no other errors but plans are missing, now show the plan notification
      if (plansMissing) {
        showNotification(t('onboarding.errors.no_plan_selected') as string, 'error');
        return;
      }

      if (!isValidUsername(committedForm.username)) {
        showNotification(t('auth.errors.invalid_username'), 'error');
        return;
      }

      const trimmedName = (committedForm.name || '').trim();
      const trimmedLastName = (committedForm.lastName || '').trim();

      if (!isValidName(trimmedName)) {
        if (trimmedName.length < 2 || trimmedName.length > 12) {
          showNotification(t('auth.errors.invalid_name_length'), 'error');
        } else {
          showNotification(t('auth.errors.invalid_name'), 'error');
        }
        return;
      }

      if (trimmedLastName && !isValidName(trimmedLastName)) {
        if (trimmedLastName.length < 2 || trimmedLastName.length > 12) {
          showNotification(t('auth.errors.invalid_name_length'), 'error');
        } else {
          showNotification(t('auth.errors.invalid_lastname'), 'error');
        }
        return;
      }

  if (committedForm.password_signup !== committedForm.confirmPassword) {
        showNotification(t('auth.errors.passwords_mismatch'), 'error');
        return;
      }

      if (!usernameAvailable) {
        showNotification(t('auth.errors.username_unavailable'), 'error');
        return;
      }
    
      if (!isValidBirthDate(committedForm.birthdate)) {
  // If we have a specific reason, prefer that message
  const reason = birthdateErrorReason || 'invalid_birthdate';
  showNotification(t(`auth.errors.${reason}`), 'error');
        return;
      }
    }

    setLoading(true);
    try {
      if (isSignup) {
        // Start signup process
        
        // Convert date from DD/MM/YYYY to YYYY-MM-DD
        const [day, month, year] = formData.birthdate.split('/');
        const formattedBirthDate = `${year}-${month}-${day}`;
        
        // First, check if the email already exists
        const { data: emailCheck } = await supabase
          .from('auth.users')
          .select('email')
          .eq('email', formData.email_signup)
          .single();



  // Build selectedmodules numeric array (IDs as numbers) from any exported plans so
  // the server-side profile creation trigger can persist it directly.
  let selectedmodules_for_signup: number[] | undefined = undefined;
        try {
          // Prefer the centralized helper which maps exported plan titles/keys to numeric module ids.
          if (fromOnboarding) {
            const ids = await getSelectedFeatureIds();
            console.log('[signup][LS][debug] getSelectedFeatureIds result:', ids);
            if (ids && ids.length > 0) selectedmodules_for_signup = ids;
          }
        } catch (e) {
          console.warn('[signup] failed to get selected feature ids from planexport helper', e);
        }

        // Include current app language/theme (use canonical profile keys)
        const sanitizeLanguage = (v: any) => {
          try { const s = String(v ?? '').trim(); return s.length > 5 ? s.slice(0,5) : s; } catch { return ''; }
        };
        const sanitizeTheme = (v: any) => {
          try { const s = String(v ?? '').toLowerCase(); return s === 'dark' ? 'dark' : 'light'; } catch { return 'light'; }
        };

        const appLanguage = sanitizeLanguage(i18n.language);
        const appTheme = sanitizeTheme(theme);

        // If we couldn't compute selectedmodules from exported plans, try reading
        // enabled modules fallback written by the plan exporter (stored as numbers)
        try {
          if (!selectedmodules_for_signup) {
            const raw = await AsyncStorage.getItem('enabledModules');
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed) && parsed.length > 0) {
                // Coerce to numbers and keep only finite numeric IDs to avoid
                // sending non-numeric strings like 'X' or 'Y' to the server.
                const nums = parsed
                  .map((n: any) => Number(n))
                  .filter((n: any) => Number.isFinite(n));
                if (nums.length > 0) selectedmodules_for_signup = nums.map((n: any) => Number(n));
              }
            }
          }
        } catch (e) {
          // non-fatal: continue without selectedmodules
          console.warn('[signup] failed to read enabledModules fallback', e);
        }

        // Create the auth user following Supabase's exact API structure
        // Make selectedmodules the first property in the signup data when present
        const optDataBase: any = {
          first_name: formData.name,
          last_name: formData.lastName,
          username: formData.username,
          birth_date: formattedBirthDate,
          role: 'user',
          applanguage: appLanguage,
          apptheme: appTheme,
        };
        const optData = selectedmodules_for_signup && Array.isArray(selectedmodules_for_signup)
          ? { selectedmodules: selectedmodules_for_signup, ...optDataBase }
          : optDataBase;

        const { data, error } = await supabase.auth.signUp({
          email: formData.email_signup,
          password: formData.password_signup,
          options: {
            emailRedirectTo: `${process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL}/auth/callback`,
            data: optData
          }
        });

        // Diagnostic log: record the raw signUp response to help debug why
        // the `profiles` row may not be created by any DB-side trigger.
        console.log('[signup][LS][debug] supabase.auth.signUp response:', { data, error });

        if (error) {
          console.error('Signup error details:', error);
          
          // Handle specific error cases
          if (error.message.includes('already registered')) {
            throw new Error(t('auth.errors.email_exists'));
          }
          if (error.message.includes('over_email_send_rate_limit') || error.status === 429) {
            throw new Error(t('auth.errors.rate_limit'));
          }
          
          throw error;
        }

        // If Supabase returned a user object immediately, attempt a best-effort
        // authenticated upsert of the `profiles` row so we can diagnose whether
        // a client-side insert is possible (useful when DB triggers are missing
        // or RLS prevents anonymous writes). This will succeed only when the
        // SDK is authorized for the new user session; otherwise the attempt will
        // fail and the error will be logged for inspection.
        try {
          if (data && (data as any).user && (data as any).user.id) {
            const uid = (data as any).user.id as string;
            const profilePayload: any = {
              id: uid,
              first_name: formData.name,
              last_name: formData.lastName,
              username: formData.username,
              birth_date: formattedBirthDate,
              role: 'user',
              applanguage: appLanguage,
              apptheme: appTheme,
              selectedmodules: Array.isArray(selectedmodules_for_signup) ? selectedmodules_for_signup : null,
            };

            console.log('[signup][LS][debug] attempting fallback profiles.upsert with payload:', profilePayload);
            try {
                const { data: upsertData, error: upsertError } = await supabase
                .from('profiles')
                .upsert(profilePayload, { returning: 'representation' } as any);

              if (upsertError) {
                console.warn('[signup][LS][debug] fallback profiles.upsert error:', upsertError);

                // If the error indicates the PostgREST schema cache is missing
                // certain columns (PGRST204 / "Could not find the ... in the schema cache"),
                // try progressively smaller payloads to gather diagnostics and
                // increase chance of a successful insert from the client.
                const schemaMsg = String((upsertError as any).message || '').toLowerCase();
                const shouldRetry = (upsertError as any)?.code === 'PGRST204' || schemaMsg.includes('could not find') || schemaMsg.includes('schema cache');

                if (shouldRetry) {
                  // Define fallback payload variants (progressively remove fields that may be missing from schema cache)
                  const attempts: Array<{label: string; payload: any}> = [];
                  // 1) remove only `role`
                  const withoutRole = { ...profilePayload };
                  delete withoutRole.role;
                  attempts.push({ label: 'without_role', payload: withoutRole });

                  // 2) remove applanguage/apptheme as well
                  const withoutLangTheme = { ...withoutRole };
                  delete withoutLangTheme.applanguage;
                  delete withoutLangTheme.apptheme;
                  attempts.push({ label: 'without_lang_theme', payload: withoutLangTheme });

                  // 3) remove selectedmodules (if server doesn't yet have that column)
                  const withoutSelected = { ...withoutLangTheme };
                  delete withoutSelected.selectedmodules;
                  attempts.push({ label: 'without_selectedmodules', payload: withoutSelected });

                  for (const attempt of attempts) {
                    try {
                      console.log('[signup][LS][debug] retrying profiles.upsert with variant:', attempt.label, attempt.payload);
                      const { data: d2, error: e2 } = await supabase
                        .from('profiles')
                        .upsert(attempt.payload, { returning: 'representation' } as any);
                      if (e2) {
                        console.warn('[signup][LS][debug] retry upsert', attempt.label, 'error:', e2);
                        continue;
                      }
                      console.log('[signup][LS][debug] retry upsert', attempt.label, 'succeeded:', d2);
                      try { await fetchUserProfile(); } catch (e) { /* ignore */ }
                      break; // success — stop retrying
                    } catch (exAttempt) {
                      console.warn('[signup][LS][debug] retry upsert threw for', attempt.label, exAttempt);
                    }
                  }
                }
              } else {
                console.log('[signup][LS][debug] fallback profiles.upsert succeeded:', upsertData);
                // If upsert succeeded, try refreshing local profile cache later
                try { await fetchUserProfile(); } catch (e) { /* ignore */ }
              }
            } catch (upsertEx) {
              console.warn('[signup][LS][debug] fallback profiles.upsert threw:', upsertEx);
            }
          } else {
            console.log('[signup][LS][debug] signUp did not return an immediate user object; cannot attempt authenticated upsert at this time');
          }
        } catch (diagErr) {
          console.warn('[signup][LS][debug] diagnostic post-signup upsert failed unexpectedly', diagErr);
        }

        // Remove all console.logs and show the notification
        showNotification(t('auth.success.check_email'), 'success');
        setShowVerification(true);
      } else {
        // Use the auth context's signIn function
        const user = await signIn(
          formData.email_login,
          formData.password_login
        );
        
  // Show success message and immediately start transition
  showNotification(t('auth.success.login_success'), 'success');
  setLoading(true);

        // Ensure user profile is fetched so we can decide routing immediately
        try { await fetchUserProfile(); } catch (e) { /* non-fatal */ }

  // Quick fade out of the content
        await new Promise<void>((resolve) => {
          Animated.timing(contentOpacity, {
            toValue: 0,
            duration: 200, // Reduced from 400ms to 200ms
            useNativeDriver: true,
          }).start(() => resolve());
        });

        // Minimal delay for visual feedback
        await new Promise(resolve => setTimeout(resolve, 300)); // Reduced from 800ms to 300ms
        
    // Navigate to Home screen under (tabs) after successful login
  router.replace('/(tabs)/home' as any);
      }
    } catch (error) {
      console.error('Full error object:', error);
      let errorMessage = t('auth.errors.unexpected');
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
        // Handle Supabase error object
        errorMessage = error.message as string;
      }
      
      console.error('Formatted error message:', errorMessage);
      showNotification(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    // Scroll to the opposite pane (signup <-> login) so both panes remain mounted.
    // Use a programmatic-guard so we don't fight the user's gesture and so we can
    // snap to exact endpoints when animation finishes.
    const targetPage = isSignup ? 1 : 0;
    const targetX = targetPage * width;
    desiredPageRef.current = targetPage;
    isProgrammaticScrollRef.current = true;
    try {
      if (scrollRef.current) scrollRef.current.scrollTo({ x: targetX, animated: true });
    } catch (e) {}

    // Preserve input state for each mode across navigation. Flush pending
    // commits to keep formData in sync, then save current mode's inputs
    // in-memory and switch modes without wiping the other mode's values.
    flushAllPendingCommits();
    try {
      saveLoginCache({ localValues: localValuesRef.current, formData }, isSignup ? 'signup' : 'login');
    } catch (e) {}
    // After saving current mode, defer restoring the target mode's cached inputs
    // until the programmatic scroll finishes to avoid visual swapping while
    // the slide animation is in progress.
    try {
      const targetCached = getLoginCache(isSignup ? 'login' : 'signup');
      pendingCacheRef.current = targetCached ?? null;
    } catch (e) { pendingCacheRef.current = null; }
  // Keep validation state and touched tracking intact so user-visible
  // errors persist across toggles as requested.
  };

  // Keep scroll position synced to initial mode on mount
  useEffect(() => {
    setTimeout(() => {
      try {
        const initialPage = isSignup ? 0 : 1;
        desiredPageRef.current = initialPage;
        isProgrammaticScrollRef.current = true;
        if (scrollRef.current) scrollRef.current.scrollTo({ x: initialPage * width, animated: false });

        // If we arrived from onboarding, keep the guard for a short window so
        // any routing/param updates don't cause a transient flip.
        try {
          const fromParam = (params as any)?.from;
            if (fromParam === 'onboarding') {
            if (initGuardTimeoutRef.current) clearTimeout(initGuardTimeoutRef.current);
            initGuardTimeoutRef.current = setTimeout(() => {
              isProgrammaticScrollRef.current = false;
              desiredPageRef.current = null;
              initGuardTimeoutRef.current = null;
            }, 500); // allow 500ms for any routing handoff to settle (reduced to feel snappier)

            // Fade in content after we've snapped to the correct page so the
            // user doesn't see a brief flash of the other pane.
            try {
              Animated.timing(contentOpacity, {
                toValue: 1,
                duration: 120,
                useNativeDriver: true,
              }).start();
            } catch (e) {}
          }
        } catch (e) {}
      } catch (e) {}
    }, 0);
    return () => {
      if (initGuardTimeoutRef.current) {
        clearTimeout(initGuardTimeoutRef.current);
        initGuardTimeoutRef.current = null;
      }
    };
  }, []);

  const onAuthScrollEnd = (e: any) => {
    const x = e.nativeEvent.contentOffset.x || 0;
    // Compute the nearest page and snap to exact endpoint if necessary
    const page = Math.max(0, Math.min(1, Math.round(x / width)));
    const expectedX = page * width;
    if (Math.abs(x - expectedX) > 1) {
      // snap to exact page to avoid mid-animation residuals
      try { if (scrollRef.current) scrollRef.current.scrollTo({ x: expectedX, animated: true }); } catch (e) {}
    }

    const newIsSignup = page === 0;

    // If this scroll was triggered programmatically, clear the guard
    if (isProgrammaticScrollRef.current) {
      isProgrammaticScrollRef.current = false;
      // Apply any pending cached inputs now that the programmatic scroll ended
      try {
        if (pendingCacheRef.current) {
          const pc = pendingCacheRef.current;
          if (pc.localValues) setLocalValues(prev => ({ ...pc.localValues, ...prev }));
          if (pc.formData) setFormData(prev => ({ ...pc.formData, ...prev }));
        }
      } catch (e) {}
      pendingCacheRef.current = null;
      desiredPageRef.current = null;
    }

    if (newIsSignup !== isSignup) setIsSignup(newIsSignup);
  };

  // Helper to render form for signup or login while keeping both mounted
  const renderForm = (modeIsSignup: boolean) => {
    const signupMode = modeIsSignup;
  const visiblePassword = signupMode ? (localValues.password_signup || formData.password_signup) : (localValues.password_login || formData.password_login);
  // Prefer live localValues for visible UI so the user never sees a cleared
  // field while debounced commits to formData are pending or during animation.
  const visibleName = (localValues.name && localValues.name.length > 0) ? localValues.name : formData.name;
  const visibleLastName = (localValues.lastName && localValues.lastName.length > 0) ? localValues.lastName : formData.lastName;
  const visibleBirthdate = (localValues.birthdate && localValues.birthdate.length > 0) ? localValues.birthdate : formData.birthdate;
  const visibleEmail = signupMode ? ((localValues.email_signup && localValues.email_signup.length > 0) ? localValues.email_signup : formData.email_signup) : ((localValues.email_login && localValues.email_login.length > 0) ? localValues.email_login : formData.email_login);
  const visibleUsername = (localValues.username && localValues.username.length > 0) ? localValues.username : formData.username;
  const visibleConfirmPassword = (localValues.confirmPassword && localValues.confirmPassword.length > 0) ? localValues.confirmPassword : formData.confirmPassword;
    return (
      <>
        <View style={styles.welcomeContainer}>
          <Svg width={75} height={75} viewBox="-35 -35 70 70">
            {/* White circle background with outline */}
            <Circle cx="0" cy="0" r="33" fill="#ffffff" stroke="#4dccc1" strokeWidth={1.5} />

            {/* Petals */}
            <Circle cx="0" cy="-20" r="8" fill="#10B981" />
            <Circle cx="17" cy="-10" r="8" fill="#34D399" />
            <Circle cx="17" cy="10" r="8" fill="#6EE7B7" />
            <Circle cx="0" cy="20" r="8" fill="#059669" />
            <Circle cx="-17" cy="10" r="8" fill="#047857" />
            <Circle cx="-17" cy="-10" r="8" fill="#22C55E" />

            {/* Center */}
            <Circle cx="0" cy="0" r="6" fill="#1F2937" />
          </Svg>
          <Text style={styles.welcomeText}>
            {signupMode ? t('auth.welcome_new', { o: i18n.language === 'es' ? (() => { const second = Math.floor(Date.now() / 1000) % 3; return second === 0 ? 'o' : second === 1 ? 'a' : 'e'; })() : 'o' }) : t('auth.welcome_back', { o: i18n.language === 'es' ? (() => { const second = Math.floor(Date.now() / 1000) % 3; return second === 0 ? 'o' : second === 1 ? 'a' : 'e'; })() : 'o' })}
          </Text>
        </View>

        <View style={styles.form}>
          {signupMode && (
            <>
              <View>
                <View style={styles.nameContainer}>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={[
                        styles.input,
                        styles.halfInput,
                        (visibleName.length > 0 && !isValidName(visibleName)) || (fieldErrors.name && touchedRef.current.signup.name) ? styles.inputError :
                        (visibleName.length > 0 && isValidName(visibleName)) ? styles.validInput : null,
                        isFieldPending('name') ? pendingStyle : null
                      ]}
                      placeholder={t('auth.fields.name')}
                      placeholderTextColor={placeholderColor}
                      value={localValues.name}
                      onChangeText={(text) => {
                        if (text.length <= 20) {
                          setLocalValues(prev => ({ ...prev, name: text }));
                          scheduleCommit('name', text);
                        }
                      }}
                      onBlur={() => commitImmediately('name', localValues.name)}
                      maxLength={15}
                      returnKeyType="next"
                      onSubmitEditing={() => {
                        if (lastNameInputSignup.current) lastNameInputSignup.current.focus();
                      }}
                      ref={nameInputSignup}
                    />
                    {!isFieldPending('name') && (
                      (() => {
                        if (fieldErrors.name && touchedRef.current.signup.name && (!visibleName || visibleName.length === 0)) {
                          return <Text style={styles.errorText}>{t('auth.errors.first_name_required')}</Text>;
                        }
                        if (visibleName && visibleName.length > 0 && !isValidName(visibleName)) {
                          return <Text style={styles.errorText}>{visibleName.length < 2 || visibleName.length > 15 ? t('auth.errors.invalid_name_length') : t('auth.errors.invalid_name')}</Text>;
                        }
                        return null;
                      })()
                    )}
                    {isFieldPending('name') && (
                      <Text style={[styles.changeLabel, { color: '#D97706', marginTop: 6, textAlign: 'left' }]}>{t('auth.status.loading')}{ellipsesText(ellipsesTick)}</Text>
                    )}
                  </View>

                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={[
                        styles.input,
                        styles.halfInput,
                        (visibleLastName.length > 0 && (isValidName(visibleLastName) ? styles.validInput : styles.inputError)),
                        isFieldPending('lastName') ? pendingStyle : null
                      ]}
                      placeholder={t('auth.fields.last_name')}
                      placeholderTextColor={placeholderColor}
                      value={localValues.lastName}
                      onChangeText={(text) => {
                        if (text.length <= 20) {
                          setLocalValues(prev => ({ ...prev, lastName: text }));
                          scheduleCommit('lastName', text);
                        }
                      }}
                      onBlur={() => commitImmediately('lastName', localValues.lastName)}
                      maxLength={15}
                      returnKeyType="next"
                      onSubmitEditing={() => { if (birthdateInputSignup.current) birthdateInputSignup.current.focus(); }}
                      ref={lastNameInputSignup}
                    />
                    {!isFieldPending('lastName') && visibleLastName.length > 0 && !isValidName(visibleLastName) && (
                      <Text style={styles.errorText}>{t('auth.errors.invalid_name')}</Text>
                    )}
                    {isFieldPending('lastName') && (
                      <Text style={[styles.changeLabel, { color: '#D97706', marginTop: 6, textAlign: 'left' }]}>{t('auth.status.loading')}{ellipsesText(ellipsesTick)}</Text>
                    )}
                  </View>
                </View>
              </View>

              <View>
                <TextInput
                  style={[
                    styles.input,
                    styles.birthdateInput,
                    (visibleBirthdate.length > 0 && !isValidBirthDate(visibleBirthdate)) || (fieldErrors.birthdate && touchedRef.current.signup.birthdate) ? styles.inputError :
                    (visibleBirthdate.length > 0 && isValidBirthDate(visibleBirthdate)) ? styles.validInput : null,
                    isFieldPending('birthdate') ? pendingStyle : null
                  ]}
                  placeholder={t('auth.birthdate_placeholder')}
                  placeholderTextColor={placeholderColor}
                  value={localValues.birthdate}
                  onChangeText={(text) => {
                    const numbersOnly = text.replace(/\D/g, '');
                    let formatted = '';
                    if (numbersOnly.length > 0) {
                      const day = numbersOnly.substring(0, 2);
                      const month = numbersOnly.length > 2 ? numbersOnly.substring(2, 4) : '';
                      const year = numbersOnly.length > 4 ? numbersOnly.substring(4, 8) : '';
                      formatted = day; if (month) formatted += '/' + month; if (year) formatted += '/' + year;
                      setLocalValues(prev => ({ ...prev, birthdate: formatted }));
                      setFieldErrors(prev => ({ ...prev, birthdate: false }));
                      setBirthdateErrorReason(null);
                      scheduleCommit('birthdate', formatted);
                      if (formatted.length === 10 && !isValidBirthDate(formatted)) {
                        const reason = getBirthdateErrorReason(formatted);
                        setFieldErrors(prev => ({ ...prev, birthdate: true }));
                        setBirthdateErrorReason(reason);
                      }
                      if (numbersOnly.length === 8) {
                        const dayNum = parseInt(day); const monthNum = parseInt(month); const yearNum = parseInt(year);
                        let valid = true; const currentDate = new Date();
                        if (dayNum < 1 || dayNum > 31) valid = false;
                        if (monthNum < 1 || monthNum > 12) valid = false;
                        const birthDate = new Date(yearNum, monthNum - 1, dayNum);
                        const age = currentDate.getFullYear() - birthDate.getFullYear();
                        const monthDiff = currentDate.getMonth() - birthDate.getMonth();
                        const dayDiff = currentDate.getDate() - birthDate.getDate();
                        const isOldEnough = age > 13 || (age === 13 && (monthDiff > 0 || (monthDiff === 0 && dayDiff >= 0)));
                        if (!isOldEnough) { valid = false; setFieldErrors(prev => ({ ...prev, birthdate: true })); setBirthdateErrorReason('invalid_birthdate_age'); }
                        else if (yearNum < 1925) { valid = false; setFieldErrors(prev => ({ ...prev, birthdate: true })); setBirthdateErrorReason('invalid_birthdate_twentyfive'); }
                        if (valid) {
                          const date = new Date(yearNum, monthNum - 1, dayNum);
                          if (date.getDate() !== dayNum || date.getMonth() !== monthNum - 1 || date.getFullYear() !== yearNum) {
                            valid = false; setFieldErrors(prev => ({ ...prev, birthdate: true })); setBirthdateErrorReason('invalid_birthdate');
                          } else { setFieldErrors(prev => ({ ...prev, birthdate: false })); setBirthdateErrorReason(null); }
                        }
                      }
                    } else { setLocalValues(prev => ({ ...prev, birthdate: '' })); scheduleCommit('birthdate', ''); }
                  }}
                  maxLength={10}
                  keyboardType="numeric"
                  returnKeyType="next"
                  onSubmitEditing={() => { if (emailInputSignup.current) emailInputSignup.current.focus(); }}
                  ref={birthdateInputSignup}
                  onBlur={() => commitImmediately('birthdate', localValues.birthdate)}
                />
                {!isFieldPending('birthdate') && ((fieldErrors.birthdate && touchedRef.current.signup.birthdate) || (visibleBirthdate.length > 0 && !isValidBirthDate(visibleBirthdate))) && (
                  <Text style={styles.errorText}>{birthdateErrorReason ? t(`auth.errors.${birthdateErrorReason}`) : (fieldErrors.birthdate ? t('auth.errors.birthdate_required') : t('auth.errors.invalid_birthdate'))}</Text>
                )}
                {isFieldPending('birthdate') && (
                  <Text style={[styles.changeLabel, { color: '#D97706', marginTop: 6, textAlign: 'left' }]}>{t('auth.status.loading')}{ellipsesText(ellipsesTick)}</Text>
                )}
              </View>
            </>
          )}

          <View>
            <TextInput
              style={[
                styles.input,
                (() => {
                  if (!signupMode) {
                    return (fieldErrors.email && touchedRef.current.login.email) ? styles.inputError : (visibleEmail.length >= 3 ? styles.validInput : null);
                  }
                  // signup mode: error if field error, invalid format, or email is known-taken
                  if ((fieldErrors.email && touchedRef.current.signup.email) || (visibleEmail.length > 0 && !isValidEmail(visibleEmail)) || (visibleEmail.length > 0 && !emailAvailable)) {
                    return styles.inputError;
                  }
                  // valid when we have a formatted email and it's available
                  if (visibleEmail.length > 0 && isValidEmail(visibleEmail) && emailAvailable) {
                    return styles.validInput;
                  }
                  return null;
                })()
              ]}
              placeholder={t(signupMode ? 'auth.fields.email' : 'auth.fields.email_or_username')}
              placeholderTextColor={placeholderColor}
              value={signupMode ? localValues.email_signup : localValues.email_login}
              onChangeText={(text) => { 
                markTouched('email'); 
                setLocalValues(prev => ({ ...prev, ...(signupMode ? { email_signup: text } : { email_login: text }) })); 
                scheduleCommit('email', text);
                // If in signup mode, debounce a server-side email existence check
                if (signupMode) {
                  try { if (emailCheckTimerRef.current) clearTimeout(emailCheckTimerRef.current as any); } catch (e) {}
                  emailCheckTimerRef.current = setTimeout(async () => {
                    const seq = ++emailCheckSeqRef.current; setCheckingEmail(true);
                    try {
                      const available = await checkEmail(text);
                      if (seq !== emailCheckSeqRef.current) return;
                      emailLastCheckedRef.current = text;
                      setFieldErrors(prev => ({ ...prev, email: !available }));
                    } catch (e) {
                      // ignore
                    } finally {
                      if (seq === emailCheckSeqRef.current) setCheckingEmail(false);
                    }
                  }, 250);
                }
              }}
              onBlur={() => commitImmediately('email', signupMode ? localValues.email_signup : localValues.email_login)}
              keyboardType={signupMode ? 'email-address' : 'default'}
              autoCapitalize="none"
              autoComplete="off"
              textContentType="none"
              ref={signupMode ? emailInputSignup : emailInputLogin}
              returnKeyType="next"
              onSubmitEditing={() => {
                if (signupMode) {
                  if (usernameInputSignup.current) usernameInputSignup.current.focus();
                } else {
                  if (passwordInputLogin.current) passwordInputLogin.current.focus();
                }
              }}
            />
            {!isFieldPending('email') && ((signupMode && ((fieldErrors.email && touchedRef.current.signup.email) || (visibleEmail.length > 0 && !isValidEmail(visibleEmail)))) || (!signupMode && ((fieldErrors.email && touchedRef.current.login.email) || (visibleEmail.length > 0 && visibleEmail.length < 3)))) && (
              <Text style={styles.errorText}>{(() => {
                if (signupMode) {
                  if (visibleEmail.length === 0) return t('auth.errors.email_required');
                  if (!isValidEmail(visibleEmail)) return t('auth.errors.invalid_email');
                  return t('auth.errors.email_required');
                }
                // login mode
                if (visibleEmail.length === 0) return t('auth.errors.login_email_required');
                if (visibleEmail.length < 3) return t('auth.errors.username_too_short');
                return null;
              })()}</Text>
            )}
            {!isFieldPending('email') && signupMode && (checkingEmail ? (
              <Text style={styles.errorText}>{t('auth.status.checking_username').replace('Unique ID', 'Email')}</Text>
            ) : (!emailAvailable && formData.email_signup.length >= 3) ? (
              <Text style={styles.errorText}>{t('auth.errors.email_in_use_custom')}</Text>
            ) : null)}
            {isFieldPending('email') && (<Text style={[styles.changeLabel, { color: '#D97706', marginTop: 6, textAlign: 'left' }]}>{t('auth.status.loading')}{ellipsesText(ellipsesTick)}</Text>)}
          </View>

          {signupMode && (
            <View>
              <TextInput
                style={[
                  styles.input,
                  (visibleUsername.length > 0 && (visibleUsername.length < 3 || !usernameAvailable)) || (fieldErrors.username && touchedRef.current.signup.username) ? styles.inputError : visibleUsername.length > 0 && usernameAvailable && visibleUsername.length >= 3 ? styles.validInput : null,
                  isFieldPending('username') ? pendingStyle : null
                ]}
                placeholder={t('auth.fields.username')}
                placeholderTextColor={placeholderColor}
                value={localValues.username}
                onChangeText={(text) => {
                  const sanitized = text.replace(/[^a-zA-Z0-9._-]/g, '');
                  if (sanitized.length <= 20) {
                    if (sanitized.length === 0 || /^[a-zA-Z]/.test(sanitized)) {
                      setLocalValues(prev => ({ ...prev, username: sanitized }));
                      setFieldErrors(prev => ({ ...prev, username: false }));
                      scheduleCommit('username', sanitized);
                      try { if (usernameCheckTimerRef.current) clearTimeout(usernameCheckTimerRef.current as any); } catch (e) {}
                      usernameCheckTimerRef.current = setTimeout(async () => {
                        const seq = ++usernameCheckSeqRef.current; setCheckingUsername(true);
                        try { const available = await checkUsername(sanitized); if (seq !== usernameCheckSeqRef.current) return; usernameLastCheckedRef.current = sanitized; setFieldErrors(prev => ({ ...prev, username: !available })); } catch (e) {} finally { if (seq === usernameCheckSeqRef.current) setCheckingUsername(false); }
                      }, 150);
                    }
                  }
                }}
                maxLength={20}
                autoCapitalize="none"
                autoCorrect={false}
                ref={usernameInputSignup}
                returnKeyType="next"
                onSubmitEditing={() => { if (passwordInputSignup.current) passwordInputSignup.current.focus(); }}
              />
              {!isFieldPending('username') && (checkingUsername ? (<Text style={styles.errorText}>{t('auth.status.checking_username')}</Text>) : (!usernameAvailable && visibleUsername.length >= 3) ? (<Text style={styles.errorText}>{t('auth.errors.username_taken', { username: visibleUsername })}</Text>) : (visibleUsername.length > 0 && visibleUsername.length < 3) ? (<Text style={styles.errorText}>{t('auth.errors.username_too_short')}</Text>) : (fieldErrors.username && touchedRef.current.signup.username) ? (<Text style={styles.errorText}>{t('auth.errors.username_required')}</Text>) : null)}
              {isFieldPending('username') && (<Text style={[styles.changeLabel, { color: '#D97706', marginTop: 6, textAlign: 'left' }]}>{t('auth.status.loading')}{ellipsesText(ellipsesTick)}</Text>)}
            </View>
          )}

            <View style={styles.passwordContainer}>
            <TextInput
              style={[
                styles.passwordInput,
                (signupMode ? (((visiblePassword.length > 0) && !isValidPassword(visiblePassword)) || (fieldErrors.password && touchedRef.current.signup.password) ? styles.inputError : (visiblePassword.length > 0 && isValidPassword(visiblePassword) ? styles.validInput : null)) : ((fieldErrors.password && touchedRef.current.login.password) ? styles.inputError : (visiblePassword.length > 0 ? styles.validInput : null))),
                isFieldPending('password') ? pendingStyle : null
              ]}
              placeholder={t('auth.fields.password')}
              placeholderTextColor={placeholderColor}
              value={signupMode ? localValues.password_signup : localValues.password_login}
              onChangeText={(text) => { markTouched('password'); setLocalValues(prev => ({ ...prev, ...(signupMode ? { password_signup: text } : { password_login: text }) })); scheduleCommit('password', text); }}
              onBlur={() => { setIsPasswordFocused(false); commitImmediately('password', signupMode ? localValues.password_signup : localValues.password_login); }}
              onFocus={() => setIsPasswordFocused(true)}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              textContentType="none"
              ref={signupMode ? passwordInputSignup : passwordInputLogin}
              returnKeyType={signupMode ? 'next' : 'done'}
              onSubmitEditing={() => { if (signupMode && confirmPasswordInputSignup.current) confirmPasswordInputSignup.current.focus(); else handleSubmit(); }}
            />
            {!isFieldPending('password') && (
              signupMode
                ? (((fieldErrors.password && touchedRef.current.signup.password) || (visiblePassword.length > 0 && !isValidPassword(visiblePassword))) ? (
                    <Text style={styles.errorText}>{(!visiblePassword || visiblePassword.length === 0) ? t('auth.errors.password_required') : t('auth.errors.password_too_short')}</Text>
                  ) : null)
                : ((fieldErrors.password && touchedRef.current.login.password) ? <Text style={styles.errorText}>{t('auth.errors.login_password_required')}</Text> : null)
            )}
            {isFieldPending('password') && (<Text style={[styles.changeLabel, { color: '#D97706', marginTop: 6, textAlign: 'left' }]}>{t('auth.status.loading')}{ellipsesText(ellipsesTick)}</Text>)}
            <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPassword(!showPassword)}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={24} color="#4A6563" />
            </TouchableOpacity>
          </View>

          {signupMode && (
            <View style={styles.passwordContainer}>
              <TextInput
                style={[
                  styles.passwordInput,
                  (visibleConfirmPassword.length > 0 && (visibleConfirmPassword === (signupMode ? (localValues.password_signup || formData.password_signup) : (localValues.password_login || formData.password_login))) ? styles.validInput : visibleConfirmPassword.length > 0 ? styles.inputError : null),
                  (fieldErrors.confirmPassword && touchedRef.current.signup.confirmPassword) && styles.inputError,
                  isFieldPending('confirmPassword') ? pendingStyle : null
                ]}
                placeholder={t('auth.fields.confirm_password')}
                placeholderTextColor={placeholderColor}
                value={localValues.confirmPassword}
                onChangeText={(text) => { setLocalValues(prev => ({ ...prev, confirmPassword: text })); scheduleCommit('confirmPassword', text); }}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
                onFocus={() => { setIsConfirmPasswordFocused(true); setIsPasswordFocused(false); }}
                onBlur={() => { setIsConfirmPasswordFocused(false); commitImmediately('confirmPassword', localValues.confirmPassword); }}
                ref={confirmPasswordInputSignup}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
              {!isFieldPending('confirmPassword') && (
                // Show 'please confirm' only when the field is empty; show mismatch when non-empty but different
                (visibleConfirmPassword.length === 0 && fieldErrors.confirmPassword) ? (
                  <Text style={styles.errorText}>{t('auth.errors.confirm_password_required')}</Text>
                ) : (visibleConfirmPassword.length > 0 && (signupMode ? (localValues.password_signup || formData.password_signup) : (localValues.password_login || formData.password_login)).length > 0 && visibleConfirmPassword !== (signupMode ? (localValues.password_signup || formData.password_signup) : (localValues.password_login || formData.password_login))) ? (
                  <Text style={styles.errorText}>{t('auth.errors.passwords_mismatch')}</Text>
                ) : null
              )}
              {isFieldPending('confirmPassword') && (<Text style={[styles.changeLabel, { color: '#D97706', marginTop: 6, textAlign: 'left' }]}>{t('auth.status.loading')}{ellipsesText(ellipsesTick)}</Text>)}
              <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={24} color="#4A6563" />
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            onPressIn={() => { /* visual feedback could go here */ }}
            onPressOut={() => { /* visual feedback end */ }}
            disabled={loading}
            accessibilityRole="button"
            activeOpacity={0.88}
            delayPressIn={0}
            pressRetentionOffset={{ top: 12, bottom: 12, left: 12, right: 12 }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.buttonText}>{loading ? t('auth.status.loading') : signupMode ? t('auth.buttons.signup') : t('auth.buttons.login')}</Text>
          </TouchableOpacity>

          <View style={{ marginTop: 0, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}>
            <Text style={{ color: '#6B7280' }}>{String(signupMode ? t('auth.links.have_account') : t('auth.links.no_account')).trimEnd()}</Text>
            <TouchableOpacity onPress={toggleMode} style={{ marginLeft: 6 }} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} accessibilityRole="button">
              <Text style={{ color: '#4dccc1', fontWeight: '700' }}>{signupMode ? t('auth.buttons.login') : t('auth.buttons.signup')}</Text>
            </TouchableOpacity>
          </View>

          {signupMode && (
            <View style={styles.bubbleRow}>
              {/* Google OAuth temporarily disabled - keep the button visible but make it a no-op */}
              <TouchableOpacity style={styles.bubble} accessibilityLabel="provider-google" onPress={() => { /* disabled */ }}>
                <Ionicons name="logo-google" size={18} color="#4DCCC1" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.bubble} accessibilityLabel="provider-apple" onPress={async () => { try { await signInWithProvider('apple'); } catch (e) { showNotification((e as Error)?.message || String(e), 'error'); } }}>
                <Ionicons name="logo-apple" size={18} color="#4DCCC1" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.bubble} accessibilityLabel="provider-facebook" onPress={async () => { try { await signInWithProvider('facebook'); } catch (e) { showNotification((e as Error)?.message || String(e), 'error'); } }}>
                <Ionicons name="logo-facebook" size={18} color="#4DCCC1" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </>
    );
  };

  // showNotification comes from NotificationContext

  const [showLanguages, setShowLanguages] = useState(false);
  const dropdownAnim = useRef(new Animated.Value(0)).current;
  const [langChanging, setLangChanging] = useState(false);
  const langOverlayAnim = useRef(new Animated.Value(0)).current;
  const [langLoadingText, setLangLoadingText] = useState<string | undefined>(undefined);

  const planAnim = useRef(new Animated.Value(isSignup ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(planAnim, {
      toValue: isSignup ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [isSignup, planAnim]);

  const languages = [
    { code: 'pt-BR', name: 'Português Brasileiro' },
    { code: 'es', name: 'Español' },
    { code: 'en', name: 'English' }
  ];

  const toggleLanguageDropdown = () => {
    if (!showLanguages) {
      setShowLanguages(true);
      Animated.spring(dropdownAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 8,
        tension: 85,
        restSpeedThreshold: 0.001,
        restDisplacementThreshold: 0.001,
      }).start();
    } else {
      Animated.timing(dropdownAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setShowLanguages(false);
      });
    }
  };

  const selectLanguage = (langCode: string) => {
    // Show the LoadingOverlay with fade-in, change language at ~300ms,
    // keep the loading visible for ~1s total, then fade out.
    setLangChanging(true);

    // Close dropdown
    Animated.timing(dropdownAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
    setTimeout(() => setShowLanguages(false), 200);

  // Show the loading word for the selected language immediately and
  // do not change it mid-flight.
  setLangLoadingText(LOADING_WORDS[langCode] ?? LOADING_WORDS['en']);

    // Fade-in overlay
    Animated.timing(langOverlayAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();

    // Change language around 300ms (visual text already shows target word)
    setTimeout(() => {
      void i18n.changeLanguage(langCode);
    }, 300);

    // Start fade-out at ~1000ms from now (1s loading), then hide and clear preview
    setTimeout(() => {
      Animated.timing(langOverlayAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        setLangChanging(false);
        setLangLoadingText(undefined);
      });
    }, 1000);
  };

  // Soft reset helper: re-fetch user profile and re-apply onboarding modules
  // after language change so the UI updates without navigating back to
  // onboarding or clearing selected plans.
  const { fetchUserProfile } = useUser();
  const softResetAfterLanguageChange = async (langCode: string) => {
    try {
      // Give i18n a small moment to switch resources
      await new Promise(resolve => setTimeout(resolve, 60));

  // Re-fetch user profile so any persisted language/theme preferences
  // are reapplied and selectedModules are reloaded.
      try { await fetchUserProfile(); } catch (e) { /* non-fatal */ }

      // Re-read selected plans only when we explicitly came from onboarding
      // (avoids bundling planexport into unrelated flows).
      try {
        if (fromOnboarding) {
          const plans = await readSelectedPlans();
          if (plans && plans.length > 0) setImportedPlans(plans as any);
        }
      } catch (e) { /* ignore */ }

    // Re-apply onboarding modules mapping to ensure enabled modules reflect
    // the new language (no-op if already persisted to profile)
  // applyOnboardingModulesIfNeeded removed to avoid bundling the plan exporter.
  // Onboarding application must be performed server-side or by an explicit flow.

      // Force a small UI refresh so any animated values using i18n update
      setTimeout(() => forceUpdate({}), 40);
    } catch (e) {
      // Keep this quiet; soft reset must not crash the screen
      console.warn('softResetAfterLanguageChange failed', e);
    }
  };

  const isValidName = (name: string) => {
    const trimmed = name.trim();
    return trimmed.length >= 2 && trimmed.length <= 15 && /^[A-Za-zÀ-ÖØ-öø-ÿ\s]+$/.test(trimmed);
  };
  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  // Require at least 8 characters, one lowercase, one uppercase, and one special character
  const isValidPassword = (password: string) => {
    if (!password || typeof password !== 'string') return false;
    if (password.length < 8) return false;
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    return hasLower && hasUpper && hasSpecial;
  };
  const isValidUsername = (username: string) => {
  return /^[a-zA-Z][a-zA-Z0-9._-]*$/.test(username) && username.length >= 3 && username.length <= 20;
  };

  const styles = getThemedStyles(isDarkMode);
  const placeholderColor = isDarkMode ? '#9CA3AF' : '#6B7280';

  const pendingStyle = { borderColor: '#D97706', borderWidth: 1.2 }; // amber-600
  const ellipsesText = (tick: number) => '.' + '.'.repeat(tick);

  return (
    <Providers>
    <View style={styles.rootContainer}>
      <Animated.View style={[
        styles.topButtonsContainer,
        { transform: [{ translateY: shiftAnim }], opacity: contentOpacity }
      ]}>
        {/* Plan selector will be rendered with the top buttons (right side) */}
        {/* Theme button */}
        <TouchableOpacity
          style={styles.themeButton}
          onPress={toggleTheme}
        >
          <Ionicons 
            name={theme === 'dark' ? 'moon-outline' : 'sunny-outline'}
            size={22}
            color="#4DCCC1"
          />
        </TouchableOpacity>

        {/* Language button */}
        <TouchableOpacity
          style={[
            styles.languageButton,
            showLanguages && styles.languageButtonActive
          ]}
          onPress={toggleLanguageDropdown}
        >
          <Ionicons 
            name="language-outline" 
            size={22} 
            color="#4DCCC1"
          />
          <AnimatedIonicons
            name="chevron-down"
            size={16}
            color="#4DCCC1"
            style={{
              transform: [{
                rotate: dropdownAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '180deg']
                })
              }]
            }}
          />
        </TouchableOpacity>

        {/* Plan button (fades when switching to login) */}
        <View style={{ marginLeft: 0 }}>
        <TouchableOpacity
            style={[styles.planButton, plansInvalid ? styles.planButtonInvalid : null]}
              onPress={() => {
              try {
                // Save local inputs into in-memory cache so onboarding navigation
                // won't clear the typed values when the user returns.
                saveLoginCache({ localValues: localValuesRef.current, formData }, isSignup ? 'signup' : 'login');
              } catch (e) {}
          // Blur inputs before navigating (preserve validation state)
          try { blurAllInputs(); } catch (e) {}
        setPlansInvalid(false); router.push('/ign-onboarding?from=login' as any);
            }}
          >
            <View style={[styles.planHalf, styles.planLeft, { paddingRight: 8 }]}> 
              {importedPlansLoaded ? (
                importedPlans && importedPlans.length > 0 ? (
                  <>
                    <Text style={[styles.planTitle, plansInvalid ? styles.planTitleInvalid : null]} numberOfLines={1} ellipsizeMode="tail">
                      {t((importedPlans[0] as any)?.key ?? importedPlans[0]?.title ?? '')}
                    </Text>
                    {importedPlans[1] ? (
                      <Text style={[styles.planCategory, plansInvalid ? styles.planCategoryInvalid : null]} numberOfLines={1} ellipsizeMode="tail">
                        {t((importedPlans[1] as any)?.key ?? importedPlans[1]?.title ?? '')}
                      </Text>
                    ) : null}
                  </>
                ) : (
                  <Text style={[styles.planTitle, plansInvalid ? styles.planTitleInvalid : null]}>{t('onboarding.no_plan') as string}</Text>
                )
              ) : (
                <Text style={[styles.planTitle, plansInvalid ? styles.planTitleInvalid : null]}>{''}</Text>
              )}
            </View>
            <View style={[styles.planHalf, styles.planRight, plansInvalid ? styles.planRightInvalid : null, { paddingLeft: 6 }]}> 
              <Text style={[styles.planArrow, plansInvalid ? styles.planArrowInvalid : null]}>{'>'}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </Animated.View>

  {/* moved: Language dropdown backdrop and dropdown are rendered at root so backdrop can cover the whole screen */}

      {/* Language dropdown backdrop (root-level) */}
      <TouchableWithoutFeedback onPress={toggleLanguageDropdown}>
        <Animated.View 
          style={[
            styles.dropdownBackdrop,
            { 
              opacity: dropdownAnim.interpolate({
                inputRange: [0, 0.1, 1],
                outputRange: [0, 0, 0.5]
              }),
              display: showLanguages ? 'flex' : 'none'
            }
          ]}
          pointerEvents={showLanguages ? 'auto' : 'none'}
        />
      </TouchableWithoutFeedback>

      

      {/* Language dropdown (root-level) */}
      <View 
        style={[
          styles.languageDropdownContainer,
          { display: showLanguages ? 'flex' : 'none' }
        ]}
        pointerEvents={showLanguages ? 'auto' : 'none'}
      >
        <Animated.View
          style={[
            styles.languageDropdown,
            {
              opacity: dropdownAnim,
              transform: [{ 
                translateY: dropdownAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-10, 0]
                })
              }]
            }
          ]}
        >
          {languages.map((lang, idx) => (
            <TouchableOpacity
              key={lang.code}
              style={[
                styles.languageOption,
                // add divider between options (except last)
                idx < languages.length - 1 ? styles.languageOptionDivider : null,
                i18n.language === lang.code && styles.languageOptionActive
              ]}
              onPress={() => {
                // If user tapped the already-selected language, just close the dropdown
                // and don't trigger a reload/change. Keep dropdown UI responsive.
                if (i18n.language === lang.code) {
                  Animated.timing(dropdownAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                  }).start(() => setShowLanguages(false));
                  return;
                }
                selectLanguage(lang.code);
              }}
            >
              <Text 
                style={[
                  styles.languageOptionText,
                  i18n.language === lang.code && styles.languageOptionTextActive
                ]}
              >
                {lang.name}
              </Text>
            </TouchableOpacity>
          ))}
        </Animated.View>
      </View>

  {/* Notification rendering moved to NotificationProvider in layout */}

      {/* Language change loading overlay (covers whole screen while switching languages) */}
      {langChanging && (
        <LoadingOverlay loadingText={langLoadingText} isDark={isDarkMode} opacity={langOverlayAnim} />
      )}

  {/* Main content */}
      <View style={{ flex: 1 }}>
          <Animated.View
            style={[
              styles.container,
              { 
                opacity: contentOpacity,
                transform: [{ translateY: shiftAnim }],
                padding: 0 // allow the pager to use full window width
              }
            ]}
          >
            {/* Horizontal pager that keeps both signup and login panes mounted */}
            <ScrollView
              ref={(r) => { scrollRef.current = r; }}
              horizontal
              // Disable user-driven scrolling so the auth screen is not swipable.
              // We keep programmatic scrollTo calls so both panes remain mounted
              // but users cannot swipe between them.
              scrollEnabled={false}
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onAuthScrollEnd}
              contentContainerStyle={{ flexDirection: 'row', alignItems: 'center' }}
              scrollEventThrottle={16}
              keyboardShouldPersistTaps="always"
              keyboardDismissMode="on-drag"
            >
              {/* Pane 1: Signup (left) - full window page that centers inner content */}
              <Animated.View
                style={[
                  styles.contentWrapper,
                  { width, padding: 0 }
                ]}
              >
                <View style={{ width: PAGE_WIDTH, marginHorizontal: HORIZONTAL_PADDING, alignSelf: 'center' }}>
                  {renderForm(true)}
                </View>
              </Animated.View>

              {/* Pane 2: Login (right) - full window page that centers inner content */}
              <Animated.View
                style={[
                  styles.contentWrapper,
                  { width, padding: 0 }
                ]}
              >
                <View style={{ width: PAGE_WIDTH, marginHorizontal: HORIZONTAL_PADDING, alignSelf: 'center' }}>
                  {renderForm(false)}
                </View>
              </Animated.View>
            </ScrollView>
          </Animated.View>
        </View>
  </View>
    </Providers>
  );
};

const getThemedStyles = (isDark: boolean) => StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: isDark ? '#0A1E1C' : '#F5F5F5',
  },
  // Ensure all Text components default to requested color
  textDefault: {
    color: '#4DCCC1',
  },
  birthdateContainer: {
    position: 'relative',
  },
  birthdateInput: {
    height: 50,
  },
  inputError: {
    borderColor: '#EF4444', // red-500
    borderWidth: 0.7,
  },
  validInput: {
    borderColor: '#16A34A', // green-600
    borderWidth: 0.7,
  },
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
    shadowOffset: {
      width: 0,
      height: 1,
    },
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
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  languageButtonActive: {
    backgroundColor: isDark ? 'rgba(14, 46, 44, 0.95)' : 'rgba(255, 255, 255, 0.95)',
  },
  languageDropdownContainer: {
  position: 'absolute',
  top: 93,
  left: 25,
  width: 160,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
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
    backgroundColor: 'rgba(77, 205, 194, 0.15)',
  },
  languageOptionText: {
    color: '#4DCCC1',
    fontSize: 14,
  },
  languageOptionTextActive: {
    fontWeight: '600',
  },
  nameContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 5,
  },
  inputWrapper: {
    flex: 1,
  },
  halfInput: {
    width: '100%',
  },
  loadingOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  backgroundColor: isDark ? '#0A1E1C' : '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000, // Increased z-index to ensure it's above everything
  },
  loadingContainer: {
  backgroundColor: isDark ? 'rgba(14, 46, 44, 0.95)' : 'rgba(255, 255, 255, 0.95)',
    borderRadius: 15,
  padding: 19,
    alignItems: 'center',
  // intentionally no shadow/elevation for a flat loading container
    borderWidth: 0.7,
    borderColor: '#4DCCC1',
  },
  loadingText: {
  color: '#4DCCC1',
  marginTop: 7,
    fontSize: 16,
    fontWeight: '500',
  },
  notification: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    padding: 16,
    zIndex: 1000,
    elevation: 8,
    borderRadius: 15,
    borderWidth: 0.7,
    borderColor: '#4DCCC1',
  },
  notificationSuccess: {
  backgroundColor: isDark ? 'rgba(14, 46, 44, 0.95)' : '#E6F7F5',
  // Match the success outline to the success text color
  borderColor: '#4dcc82ff',
  },
  notificationError: {
  backgroundColor: isDark ? 'rgba(14, 46, 44, 0.95)' : '#FFF5F5',
  // Match the error outline to the error text color
  borderColor: '#EF4444',
  },
  notificationText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
    color: '#4DCCC1',
  },
  notificationTextSuccess: {
    color: '#4dcc82ff',
  },
  notificationTextError: {
  color: '#EF4444',
  },
  errorText: {
  color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  container: {
    flex: 1,
    backgroundColor: isDark ? '#0A1E1C' : '#F5F5F5',
  padding: 15,
    justifyContent: 'center',
  },
  contentWrapper: {
    flex: 1,
    backgroundColor: isDark ? '#0A1E1C' : '#F5F5F5',
  padding: 15,
    justifyContent: 'center',
  },
  welcomeContainer: {
    alignItems: 'center',
  marginBottom: 12,
  },
  welcomeText: {
    fontSize: 32,
    fontWeight: 'bold',
  color: '#4DCCC1',
  marginTop: 4,
  },
  form: {
  gap: 8,
  },
  input: {
    height: 50,
    borderWidth: 0.7,
    borderColor: '#4DCCC1',
    borderRadius: 15,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: isDark ? 'rgba(14, 46, 44, 0.85)' : 'rgba(255, 255, 255, 0.9)',
  color: isDark ? '#E5E7EB' : '#374151', // lighter text in dark mode, mid-grey in light mode
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    height: 50,
    borderWidth: 0.7,
    borderColor: '#4DCCC1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingRight: 50,
    fontSize: 16,
    backgroundColor: isDark ? 'rgba(14, 46, 44, 0.85)' : 'rgba(255, 255, 255, 0.9)',
  color: isDark ? '#E5E7EB' : '#374151',
  },
  eyeIcon: {
    position: 'absolute',
    right: 12,
    top: 12,
    padding: 2,
  },
  button: {
    height: 50,
    width: '100%',
    // Use toned teal backgrounds depending on theme (dark/light)
    backgroundColor: isDark ? 'rgba(15,118,110,0.12)' : 'rgba(15,118,110,0.10)',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  marginTop: 4,
    paddingHorizontal: 20,
    borderWidth: 0.7,
    borderColor: '#4DCCC1',
  },
  buttonText: {
    color: '#4DCCC1',
    fontSize: 16,
    fontWeight: '600',
  width: '100%',
  textAlign: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  oAuthButton: {
    height: 50,
    width: '100%',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 0.7,
    borderColor: '#4DCCC1',
    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)'
  },
  oAuthButtonText: {
    color: '#4DCCC1',
    fontWeight: '600'
  },
  bubbleRow: {
    marginTop: 3,
    marginBottom: 5,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  bubble: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 0.7,
    borderColor: '#4DCCC1',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.03)'
  },
  // onboarding-style switch row is rendered inline; legacy styles removed
  datePicker: {
    height: 50,
    borderWidth: 0.7,
    borderColor: '#4DCCC1',
    borderRadius: 15,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: isDark ? 'rgba(14, 46, 44, 0.85)' : 'rgba(255, 255, 255, 0.9)',
    color: '#4DCCC1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownBackdrop: {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'transparent',
  // keep backdrop just under the dropdown
  zIndex: 999,
  },
  planButtonWrapper: {
  // removed: left-anchored wrapper; plan button now lives in topButtonsContainer
  display: 'none'
  },
  planButton: {
  flexDirection: 'row',
  borderRadius: 20,
  overflow: 'hidden',
  borderWidth: 0.7,
  borderColor: '#4DCCC1',
  backgroundColor: isDark ? 'rgba(14, 46, 44, 0.85)' : 'rgba(255, 255, 255, 0.9)',
  height: 44,
  minWidth: 140,
  alignItems: 'center',
  // removed shadow/elevation to keep the plan button flat
  },
  planButtonInvalid: {
    borderColor: '#EF4444',
    borderWidth: 1,
  },
  planHalf: {
  paddingHorizontal: 10,
  justifyContent: 'center',
  alignItems: 'flex-start',
  height: '100%',
  },
  planLeft: {
    paddingLeft: 12,
  },
  planRight: {
    borderLeftWidth: 0.7,
    borderLeftColor: '#4DCCC1',
  },
  planRightInvalid: {
    borderLeftColor: '#EF4444',
  },
  planLabel: {
    fontSize: 12,
    color: '#4DCCC1',
    opacity: 0.9,
  },
  planTitle: {
    fontSize: 14,
    color: '#4DCCC1',
    fontWeight: '700',
    lineHeight: 16,
  },
  planTitleInvalid: {
    color: '#EF4444',
  },
  planCategory: {
    fontSize: 11,
    color: isDark ? '#9CA3AF' : '#6B7280',
    marginTop: 0,
  },
  planCategoryInvalid: {
    color: '#EF4444',
  },
  changeLabel: {
    fontSize: 12,
    color: '#4DCCC1',
    fontWeight: '600',
  textAlign: 'left',
  },
  planArrow: {
    fontSize: 18,
    color: '#4DCCC1',
    fontWeight: '700',
    paddingHorizontal: 8,
  },
  planArrowInvalid: {
    color: '#EF4444',
  },
  planName: {
    fontSize: 14,
    color: '#4DCCC1',
    fontWeight: '700',
  },
  linkText: {
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
});