// ProfileScreen.tsx
import Providers from '@/components/Providers';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { router, useSegments } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ImageCropperPopup from '../../components/ImageCropperPopup';
import LogoutConfirmationModal from '../../components/LogoutConfirmationModal';
import OTPpopup from '../../components/OTPpopup';
import { useNotification } from '../../contexts/NotificationContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useUser } from '../../contexts/UserContext';
import { supabase, testSupabaseConnection } from '../../lib/supabase';
const AnimatedSafeAreaView = Animated.createAnimatedComponent(SafeAreaView);
// Buffer is used to convert base64 -> binary in React Native environments
import { Buffer } from 'buffer';

// Types
interface FormData {
  firstName: string;
  lastName: string;
  username: string;
  birthDate: string;
}

interface FieldErrors {
  firstName: boolean;
  lastName: boolean;
  username: boolean;
  birthDate: boolean;
}

// Constants
const COLORS = {
  darkBg: '#0A1E1C',
  accent: '#4DCDC2',
  accentLight: '#80E6D9',
  accentLightText: '#E0F7F4',
  error: '#ff4444',
  success: '#328864ff',
  inputBorderDark: '#0E2E2C',
  mutedText: '#4A6563',
  white: '#FFFFFF',
};

const SIZES = {
  padding: 16,
  gap: 10,
  avatarSize: 120,
  avatarInner: 116,
};

const WINDOW = Dimensions.get('window');
const DEBOUNCE_MS = 500;

// Validation utilities
const ValidationUtils = {
  isValidName: (name: string, required = true) => {
    const trimmed = name.trim();
    if (!required && trimmed === '') return true;
    return trimmed.length >= 2 && trimmed.length <= 15 && /^[A-Za-zÀ-ÖØ-öø-ÿ\s]+$/.test(trimmed);
  },

  isValidUsername: (username: string) => {
    return /^[a-zA-Z][a-zA-Z0-9._-]*$/.test(username) && username.length >= 3 && username.length <= 20;
  },

  isValidBirthDate: (date: string) => {
    const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    if (!dateRegex.test(date)) return false;
    
    const [day, month, year] = date.split('/').map(Number);
    if (year < 1925) return false;
    
    const dateObj = new Date(year, month - 1, day);
    if (!(dateObj.getDate() === day && dateObj.getMonth() === month - 1 && dateObj.getFullYear() === year)) {
      return false;
    }
    
    const now = new Date();
    let age = now.getFullYear() - year;
    const monthDiff = now.getMonth() - (month - 1);
    const dayDiff = now.getDate() - day;
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) age--;
    
    return age >= 13;
  },

  getBirthdateErrorKey: (date: string): string | null => {
    if (!date) return null;
    const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    if (!dateRegex.test(date)) return 'invalid_birthdate';
    
    const [day, month, year] = date.split('/').map(Number);
    if (year < 1925) return 'invalid_birthdate_twentyfive';
    
    const dateObj = new Date(year, month - 1, day);
    if (!(dateObj.getDate() === day && dateObj.getMonth() === month - 1 && dateObj.getFullYear() === year)) {
      return 'invalid_birthdate';
    }
    
    const currentDate = new Date();
    let age = currentDate.getFullYear() - dateObj.getFullYear();
    const monthDiff = currentDate.getMonth() - dateObj.getMonth();
    const dayDiff = currentDate.getDate() - dateObj.getDate();
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) age--;
    
    if (age < 13) return 'invalid_birthdate_age';
    return null;
  },

  formatBirthDateInput: (text: string) => {
    const numbersOnly = text.replace(/\D/g, '');
    let formatted = '';
    
    if (numbersOnly.length > 0) {
      const day = numbersOnly.substring(0, 2);
      const month = numbersOnly.length > 2 ? numbersOnly.substring(2, 4) : '';
      const year = numbersOnly.length > 4 ? numbersOnly.substring(4, 8) : '';
      
      formatted = day;
      if (month) formatted += '/' + month;
      if (year) formatted += '/' + year;
    }
    
    return formatted;
  }
};

// Components
const AvatarPicker: React.FC<{ 
  uri?: string | null; 
  onPick: () => void; 
  styles: any;
}> = ({ uri, onPick, styles }) => (
  <View style={styles.imageContainer}>
    <View style={styles.avatarContainer}>
      {uri ? (
        <Image source={{ uri }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Ionicons name="person" size={40} color="#80E6D9" />
        </View>
      )}
    </View>
    <TouchableOpacity 
      onPress={onPick} 
      style={styles.cameraButton} 
      activeOpacity={0.85}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Ionicons name="camera" size={20} color="#E0F7F4" />
    </TouchableOpacity>
  </View>
);

const ValidatedInput = React.forwardRef<TextInput, {
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  placeholder: string;
  error?: string;
  isValid?: boolean;
  isPending?: boolean;
  styles: any;
  inputStyle?: any;
  [key: string]: any;
}>(({ value, onChangeText, onBlur, placeholder, error, isValid, isPending, styles, ...props }, ref) => {
  const { t } = useTranslation();

  const borderStyle = isPending 
    ? { borderColor: '#D97706' }
    : error 
    ? styles.inputError
    : isValid 
    ? styles.validInput 
    : null;

  return (
    <View style={{ flex: 1 }}>
      <TextInput
        ref={ref}
  style={[styles.input, borderStyle, props.inputStyle]}
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        placeholder={placeholder}
        placeholderTextColor="#4A6563"
        {...props}
      />
      {/* Reserve a small space (5px) for errors/pending so layout doesn't jump; this grows to fit content */}
      <View style={[
        styles.errorSpacer,
        {
          height: error || isPending ? 'auto' : 3,
          minHeight: error || isPending ? 5 : 3,
          paddingTop: error || isPending ? 2 : 0
        }
      ]}>
        {isPending ? (
          <LoadingDots text={t('auth.status.loading')} />
        ) : (
          <Text style={styles.errorText}>{error ?? ''}</Text>
        )}
      </View>
    </View>
  );
});

// LockableField: uses shared activeField so only one input is editable at a time.
const LockableField: React.FC<any> = ({ styles, fieldKey, activeField, setActiveField, prefix, iconName, ...props }) => {
  const inputRef = React.useRef<TextInput | null>(null);

  const editable = activeField === fieldKey;

  const enableEdit = () => {
    setActiveField(fieldKey);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const disableEdit = () => {
    inputRef.current?.blur();
    setActiveField(null);
  };

  // double-tap detection: two taps within 300ms enable editing
  const lastTapRef = React.useRef<number | null>(null);
  const handleContainerPress = () => {
    if (editable) return; // already editing
    const now = Date.now();
    if (lastTapRef.current && now - lastTapRef.current < 300) {
      // double tap detected
      enableEdit();
      lastTapRef.current = null;
    } else {
      lastTapRef.current = now;
      // clear after timeout
      setTimeout(() => { lastTapRef.current = null; }, 350);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={handleContainerPress}>
      <View style={{ position: 'relative', width: '100%' }}>
      {/* Render immutable prefix (eg. @) or leading icon inside the input */}
      {iconName ? (
        <Ionicons name={iconName} size={16} color="#4DCCC1" style={{ position: 'absolute', left: 10, top: 15, zIndex: 10 }} />
      ) : prefix ? (
        <Text selectable={false} pointerEvents="none" style={{ position: 'absolute', left: 12, top: 15, zIndex: 10, color: '#4DCCC1', fontWeight: '600', fontSize: 16 }}>{prefix}</Text>
      ) : null}

  <ValidatedInput
    ref={inputRef}
    editable={editable}
    styles={styles}
    // make room for the prefix/icon by adding left padding when present
  // If there's a leading icon, keep larger left padding; if it's a simple prefix (like "@"), reduce padding so the prefix is closer to the text
  inputStyle={[{ paddingRight: 44, paddingLeft: iconName ? 28 : prefix ? 28 : 12 }, props.inputStyle]}
    onSubmitEditing={() => { disableEdit(); }}
    {...props}
  />
      <TouchableOpacity
        onPress={editable ? disableEdit : enableEdit}
        style={[styles.lockButton, { position: 'absolute', right: 6, top: 8 }]}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name={editable ? 'checkmark' : 'pencil'} size={18} color="#80E6D9" />
      </TouchableOpacity>
    </View>
  </TouchableWithoutFeedback>
  );
};

// BirthdateField: keeps slashes locked and formats input as DD/MM/YYYY.
const BirthdateField: React.FC<any> = ({ styles, fieldKey, activeField, setActiveField, value, onChangeText, error, isValid, isPending, ...props }) => {
  const inputRef = useRef<TextInput | null>(null);
  const editable = activeField === fieldKey;
  const [selection, setSelection] = useState<{ start: number; end: number } | undefined>(undefined);

  const enableEdit = () => {
    setActiveField(fieldKey);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const disableEdit = () => {
    inputRef.current?.blur();
    setActiveField(null);
  };

  const handleChange = (text: string) => {
    // Keep only digits and limit to 8 (DDMMYYYY)
    const digits = (text || '').replace(/\D/g, '').slice(0, 8);
    const formatted = ValidationUtils.formatBirthDateInput(digits);
    // move caret to end to avoid jumpy behavior
    setSelection({ start: formatted.length, end: formatted.length });
    // call parent's handler with formatted value
    if (typeof onChangeText === 'function') onChangeText(formatted);
  };

  // double-tap detection for BirthdateField (two taps within 300ms)
  const lastTapRef = useRef<number | null>(null);
  const handleContainerPress = () => {
    if (editable) return;
    const now = Date.now();
    if (lastTapRef.current && now - lastTapRef.current < 300) {
      enableEdit();
      lastTapRef.current = null;
    } else {
      lastTapRef.current = now;
      setTimeout(() => { lastTapRef.current = null; }, 350);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={handleContainerPress}>
      <View style={{ position: 'relative', width: '100%' }}>
        {/* Calendar icon (immutable) placed like the @ prefix */}
        <Ionicons
          name="calendar-outline"
          size={16}
          color="#4DCCC1"
          style={{ position: 'absolute', left: 10, top: 15, zIndex: 10 }}
        />
        <ValidatedInput
          ref={inputRef}
          editable={editable}
          styles={styles}
          value={value}
          onChangeText={handleChange}
          inputStyle={[{ paddingRight: 44, paddingLeft: 28 }, props.inputStyle]}
          onSubmitEditing={() => { disableEdit(); }}
          error={error}
          isValid={isValid}
          isPending={isPending}
          selection={selection}
          keyboardType="numeric"
          {...props}
        />
        <TouchableOpacity
          onPress={editable ? disableEdit : enableEdit}
          style={[styles.lockButton, { position: 'absolute', right: 6, top: 8 }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name={editable ? 'checkmark' : 'pencil'} size={18} color="#80E6D9" />
        </TouchableOpacity>
      </View>
    </TouchableWithoutFeedback>
  );
};

const LoadingDots: React.FC<{ text: string }> = ({ text }) => {
  const [dots, setDots] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => setDots(d => (d + 1) % 4), 300);
    return () => clearInterval(interval);
  }, []);
  
  return (
  <Text style={{ color: '#D97706', fontSize: 12, marginTop: 0, textAlign: 'left', lineHeight: 15, paddingBottom: 0, marginBottom: 0 }}>
      {text}{'.'.repeat(dots)}
    </Text>
  );
};

// Custom hook for form validation
const useFormValidation = (userProfile: any, initialUsername?: string) => {
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({
    firstName: false,
    lastName: false,
    username: false,
    birthDate: false,
  });
  
  const [pendingFields, setPendingFields] = useState<Set<string>>(new Set());
  const [usernameAvailable, setUsernameAvailable] = useState(true);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [birthdateErrorKey, setBirthdateErrorKey] = useState<string | null>(null);
  
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  
  const validateField = useCallback(async (field: string, value: string) => {
    // Clear existing timer
    if (timersRef.current[field]) {
      clearTimeout(timersRef.current[field]);
    }
    
    // Set pending state
    setPendingFields(prev => new Set([...prev, field]));
    
    timersRef.current[field] = setTimeout(async () => {
      let isValid = true;
      let errorKey: string | null = null;
      
      switch (field) {
        case 'firstName':
          isValid = ValidationUtils.isValidName(value, true);
          break;
        case 'lastName':
          isValid = ValidationUtils.isValidName(value, false);
          break;
        case 'username':
          if (ValidationUtils.isValidUsername(value)) {
            // Normalize for comparison: trim + lowercase
            const normalizedValue = value.trim().toLowerCase();
            const normalizedInitial = initialUsername ? initialUsername.trim().toLowerCase() : undefined;

            // If the username equals the initial username shown on page load, treat it as available
            if (normalizedInitial && normalizedValue === normalizedInitial) {
              setUsernameAvailable(true);
              isValid = true;
              break;
            }

            try {
              setCheckingUsername(true);
              const { data } = await supabase.rpc('check_username_exists', { p_username: value });
              const exists = !!data;
              const isCurrentUser = userProfile?.username && userProfile.username.trim().toLowerCase() === normalizedValue;
              const available = !exists || isCurrentUser;
              setUsernameAvailable(available);
              isValid = available;
            } catch (error) {
              console.error('Username check error:', error);
              isValid = false;
            } finally {
              setCheckingUsername(false);
            }
          } else {
            isValid = false;
          }
          break;
        case 'birthDate':
          isValid = ValidationUtils.isValidBirthDate(value);
          errorKey = ValidationUtils.getBirthdateErrorKey(value);
          setBirthdateErrorKey(errorKey);
          break;
      }
      
      setFieldErrors(prev => ({ ...prev, [field]: !isValid }));
      setPendingFields(prev => {
        const newSet = new Set(prev);
        newSet.delete(field);
        return newSet;
      });
    }, DEBOUNCE_MS);
  }, [userProfile]);
  
  const isFieldPending = (field: string) => pendingFields.has(field);
  
  return {
    fieldErrors,
    isFieldPending,
    usernameAvailable,
    checkingUsername,
    birthdateErrorKey,
    validateField,
    setFieldErrors
  };
};

// Main component
export default function ProfileScreen() {
  const { t } = useTranslation();
  const { userProfile, fetchUserProfile } = useUser();
  const { theme } = useTheme();
  const { showNotification } = useNotification();
  const isDarkMode = theme === 'dark';
  const styles = getThemedStyles(isDarkMode);
  
  // Form state
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    username: '',
    birthDate: '',
  });
  
  const [originalValues, setOriginalValues] = useState<FormData>({
    firstName: '',
    lastName: '',
    username: '',
    birthDate: '',
  });
  
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  // which field is currently editable; only one may be active at a time
  const [activeField, setActiveField] = useState<string | null>(null);
  // Local preview for profile picture: show immediately but don't persist until update
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  // Store base64 from the picker when available so uploads don't rely on fetch(file://)
  const [selectedImageBase64, setSelectedImageBase64] = useState<string | null>(null);
  // UI state for profile update in progress
  const [isUpdating, setIsUpdating] = useState(false);
  // Track whether the form differs from the original snapshot (dirty)
  const isDirty = useMemo(() => {
    // Only consider dirty once we have initialized the original values
    if (!isInitialized) return false;
    // If a new local image preview exists, user changed avatar
    if (selectedImageUri) return true;
    // Compare each field to original snapshot
    const normalize = (s?: string) => (s ?? '').trim().toLowerCase();
    return (
      formData.firstName !== originalValues.firstName ||
      formData.lastName !== originalValues.lastName ||
      normalize(formData.username) !== normalize(originalValues.username) ||
      formData.birthDate !== originalValues.birthDate
    );
  }, [isInitialized, selectedImageUri, formData, originalValues]);
  
  const validation = useFormValidation(userProfile, originalValues.username);
  // email change modal state
  const [emailModalVisible, setEmailModalVisible] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [sendingPasswordReset, setSendingPasswordReset] = useState(false);
  const [sendingEmailChange, setSendingEmailChange] = useState(false);
  const animatedShift = useRef(new Animated.Value(0)).current;
  const fadeOutAnim = useRef(new Animated.Value(0)).current;
  const segments = useSegments();

  // Reset fade when this screen becomes active so it is visible on reopen
  useEffect(() => {
    try {
      const segStrings = Array.isArray(segments) ? segments.map(s => String(s)) : [];
      const active = segStrings.some(s => s.startsWith('ign-account'));
      if (active) {
        // Animate entrance using the same timing as the exit for symmetry
        Animated.timing(fadeOutAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
      }
    } catch (e) {
      // ignore
    }
  }, [segments, fadeOutAnim]);

  const doExit = () => {
    try {
      Animated.timing(fadeOutAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
        try { router.back(); } catch (e) { /* ignore */ }
      });
    } catch (e) {
      try { router.back(); } catch (e) { /* ignore */ }
    }
  };
  // Confirm button enabled when input looks like an email and not currently sending
  const isConfirmDisabled = sendingEmailChange || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail);

  // Shift modal up when keyboard shows (no KeyboardAvoidingView) using Animated for smoothness
  useEffect(() => {
    const eventShow = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const eventHide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    // Smaller movement and gentle spring to match OTPpopup behavior
    const onShow = (e: any) => {
      const h = e?.endCoordinates?.height ?? 300;
  // increase movement: 20% of keyboard height, capped at 16% of window height
  const target = Math.min(h * 0.20, WINDOW.height * 0.16);
      Animated.spring(animatedShift, { toValue: target, tension: 40, friction: 9, useNativeDriver: true }).start();
    };

    const onHide = () => {
      Animated.spring(animatedShift, { toValue: 0, tension: 40, friction: 9, useNativeDriver: true }).start();
    };

    const showSub = Keyboard.addListener(eventShow, onShow);
    const hideSub = Keyboard.addListener(eventHide, onHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [animatedShift]);

  // Notifications are handled by the global NotificationProvider; useNotification() provides showNotification
  
  // Initialize form from user profile
  useEffect(() => {
    if (userProfile && !isInitialized) {
      let formattedBirthDate = '';
      if (userProfile.birthDate) {
        const [y, m, d] = userProfile.birthDate.split('-');
        formattedBirthDate = `${d}/${m}/${y}`;
      }
      
      const initialData = {
        firstName: userProfile.firstName || '',
        lastName: userProfile.lastName || '',
        username: userProfile.username || '',
        birthDate: formattedBirthDate,
      };
      
      setFormData(initialData);
      setOriginalValues(initialData);
      setIsInitialized(true);
    }
  }, [userProfile, isInitialized]);
  
  // Field update handlers
  const updateField = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    validation.validateField(field, value);
  };
  
  const handleNameChange = (field: 'firstName' | 'lastName', text: string) => {
    if (text.length <= 20) {
      updateField(field, text);
    }
  };
  
  const handleBirthDateChange = (text: string) => {
    const formatted = ValidationUtils.formatBirthDateInput(text);
    updateField('birthDate', formatted);
  };
  
  const handleUsernameChange = (text: string) => {
    const sanitized = text.replace(/[^a-zA-Z0-9._-]/g, '');
    if (sanitized.length <= 20 && (sanitized.length === 0 || /^[a-zA-Z]/.test(sanitized))) {
      updateField('username', sanitized);
    }
  };
  
  // Validation helpers
  const isFieldValid = (field: keyof FormData) => {
    const value = formData[field];
    switch (field) {
      case 'firstName':
        return ValidationUtils.isValidName(value, true);
      case 'lastName':
        return ValidationUtils.isValidName(value, false);
      case 'username':
        return ValidationUtils.isValidUsername(value) && validation.usernameAvailable;
      case 'birthDate':
        return ValidationUtils.isValidBirthDate(value);
      default:
        return false;
    }
  };
  
  const hasFieldChanged = (field: keyof FormData) => {
    return formData[field] !== originalValues[field];
  };
  
  const getFieldError = (field: keyof FormData) => {
    if (validation.isFieldPending(field)) return undefined;
    if (!validation.fieldErrors[field]) return undefined;
    
    const value = formData[field];
    
    switch (field) {
      case 'firstName':
        if (!value.trim()) return t('auth.errors.first_name_required');
        if (value.trim().length < 2 || value.trim().length > 15) return t('auth.errors.invalid_name_length');
        return t('auth.errors.invalid_name');
      
      case 'lastName':
        return value.length > 0 ? t('auth.errors.invalid_name') : undefined;
      
      case 'username':
        if (!validation.usernameAvailable && value.length >= 3) {
          return t('auth.errors.username_taken', { username: value });
        }
        if (value.length > 0 && value.length < 3) return t('auth.errors.username_too_short');
        return t('auth.errors.username_required');
      
      case 'birthDate':
        if (validation.birthdateErrorKey) {
          return t(`auth.errors.${validation.birthdateErrorKey}`);
        }
        return t('auth.errors.invalid_birthdate');
      
      default:
        return undefined;
    }
  };
  
  // Image handling
  const [showCropper, setShowCropper] = useState(false);
  const [showOtpPreview, setShowOtpPreview] = useState(false);

  // Hardware back button handling (Android): prefer to close modals/inputs, otherwise navigate back
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const onBackPress = () => {
      // If any modal is open, close it first
      if (showCropper) { setShowCropper(false); return true; }
      if (showOtpPreview) { setShowOtpPreview(false); return true; }
      if (emailModalVisible) { setEmailModalVisible(false); return true; }
      if (showLogoutModal) { setShowLogoutModal(false); return true; }
      // If a field is being edited, blur it (close keyboard) before navigating back
      if (activeField) {
        setActiveField(null);
        Keyboard.dismiss();
        return true;
      }

      // Otherwise, use the animated exit so native back matches header back
      try {
        doExit();
      } catch (e) {
        try { router.back(); } catch (e) { /* ignore */ }
      }
      return true;
    };

  const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
  return () => { try { sub.remove(); } catch (e) { /* ignore */ } };
  }, [showCropper, showOtpPreview, emailModalVisible, showLogoutModal, activeField]);

  const handleImageSelected = async (croppedUri: string) => {
    try {
      setShowCropper(false);
      setSelectedImageUri(croppedUri);
      
      // Convert the cropped image to base64 for our existing upload logic
      const response = await fetch(croppedUri);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onload = () => {
        const base64data = (reader.result as string)?.split(',')[1];
        setSelectedImageBase64(base64data);
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error('Error converting cropped image:', err);
      setSelectedImageBase64(null);
      showNotification(t('profile.errors.generic_image_error'), 'error');
    }
  };

  // Send password reset email to the current user's email
  const handleSendPasswordReset = async () => {
    setSendingPasswordReset(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !user.email) {
        showNotification(t('profile.errors.no_email_on_account') || 'No email on account', 'error');
        return;
      }
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: undefined,
      });
      if (error) throw error;
      showNotification(t('profile.success.reset_sent') || 'Password reset email sent', 'success');
      // Auto-open OTP popup so user can enter code if needed
      setShowOtpPreview(true);
    } catch (err) {
      console.error('Password reset failed:', err);
      showNotification(t('profile.errors.reset_failed') || 'Failed to send password reset email', 'error');
    } finally {
      setSendingPasswordReset(false);
    }
  };

  // Trigger email change flow: open modal to input new email, then call supabase.auth.updateUser
  const handleStartEmailChange = () => {
    setNewEmail('');
    setEmailModalVisible(true);
  };

  const handleConfirmEmailChange = async () => {
    try {
      if (!newEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail)) {
        showNotification(t('profile.errors.invalid_email') || 'Invalid email', 'error');
        return;
      }
      const { data, error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      setEmailModalVisible(false);
  showNotification(t('profile.success.email_change_requested') || 'Check your inbox to confirm the new email', 'success');
  // Auto-open OTP confirmation popup so user can enter code if needed
  setShowOtpPreview(true);
    } catch (err) {
      console.error('Email change failed:', err);
      showNotification(t('profile.errors.email_change_failed') || 'Failed to change email', 'error');
    }
  };
  
  // Upload a local file URI to storage and return the public URL.
  // Does NOT update the profiles table; caller should handle DB update.
  const uploadToStorage = async (uri: string, base64?: string | null) => {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) throw new Error('user_not_found');

    // Determine extension from uri fallback
    let ext = 'jpg';
    try {
      const match = uri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
      if (match && match[1]) ext = match[1].toLowerCase();
    } catch (e) {
      // keep default
    }

  // Default to a user-prefixed path so common RLS policies allow the upload
  let fileName = `${user.id}/${user.id}.${ext}`;

    let blob: any = null;

    // Debug: log user/session info
    try {
      const session = await supabase.auth.getSession();
      console.log('Uploading avatar, user id=', user.id, 'session?', !!session?.data?.session);
    } catch (e) {
      console.warn('Could not read supabase session before upload', e);
    }

    // Always attempt to resize/compress to 512x512 JPEG before upload
    let uploadUri = uri;
    try {
      // Request base64 directly from the manipulator to avoid a second fetch
      const manipulated = await manipulateAsync(uri, [{ resize: { width: 512, height: 512 } }], { compress: 0.8, format: SaveFormat.JPEG, base64: true });
      ext = 'jpg';

      if (manipulated.base64) {
        const buf = Buffer.from(manipulated.base64, 'base64');
        const uploadOptions = { contentType: `image/${ext}`, upsert: true, cacheControl: '0' } as any;
        let { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, buf, uploadOptions);
        if (uploadError) {
          console.error('Buffer upload error:', uploadError);
          const msg = (uploadError?.message || '').toLowerCase();
          if (msg.includes('row-level') || msg.includes('violates row-level')) {
            const altName = `${user.id}/${fileName}`;
            console.log('Retrying buffer upload with user-prefixed path:', altName);
            const { error: altErr } = await supabase.storage.from('avatars').upload(altName, buf, uploadOptions);
            if (altErr) {
              console.error('Alt buffer upload failed:', altErr);
              throw altErr;
            }
            fileName = altName;
          } else {
            throw uploadError;
          }
        }
      } else {
        // Fallback to fetching the manipulated URI (if manipulator didn't return base64)
        const uploadUriFallback = manipulated.uri ?? uploadUri;
        const response = await fetch(uploadUriFallback);
        if (!response.ok) throw new Error('failed_fetch_image');
        const arrayBuffer = await response.arrayBuffer();
        const buf = Buffer.from(arrayBuffer);
        const uploadOptions = { contentType: `image/${ext}`, upsert: true, cacheControl: '0' } as any;
        let { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, buf, uploadOptions);
        if (uploadError) {
          console.error('Fallback buffer upload error:', uploadError);
          const msg = (uploadError?.message || '').toLowerCase();
          if (msg.includes('row-level') || msg.includes('violates row-level')) {
            const altName = `${user.id}/${fileName}`;
            console.log('Retrying fallback buffer upload with user-prefixed path:', altName);
            const { error: altErr } = await supabase.storage.from('avatars').upload(altName, buf, uploadOptions);
            if (altErr) {
              console.error('Alt fallback buffer upload failed:', altErr);
              throw altErr;
            }
            fileName = altName;
          } else {
            throw uploadError;
          }
        }
      }
    } catch (err) {
      console.error('Failed to manipulate/fetch/upload image buffer:', err);
      throw err;
    }

    console.log('Final avatar storage path:', fileName);

    // Clean up older avatar files in the same user folder so only the latest remains
    try {
      const { data: listData, error: listErr } = await supabase.storage.from('avatars').list(`${user.id}/`);
      if (listErr) {
        console.warn('Could not list existing avatar files for cleanup:', listErr);
      } else if (Array.isArray(listData) && listData.length > 0) {
        const toRemove: string[] = [];
        for (const item of listData) {
          const itemPath = `${user.id}/${item.name}`;
          if (itemPath !== fileName) toRemove.push(itemPath);
        }
        if (toRemove.length > 0) {
          const { error: delErr } = await supabase.storage.from('avatars').remove(toRemove);
          if (delErr) console.warn('Failed to remove old avatar files:', delErr);
          else console.log('Removed old avatar files:', toRemove);
        }
      }
    } catch (cleanupErr) {
      console.warn('Avatar cleanup failed:', cleanupErr);
    }

    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    if (!urlData?.publicUrl) throw new Error('no_public_url');
    return urlData.publicUrl;
  };

  // Small helper to wait
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Ensure Supabase is reachable with a few retries and exponential backoff.
  // Returns true when reachable, false otherwise.
  const ensureSupabaseReachable = async (attempts = 3) => {
    if (!supabase) return false;
    for (let i = 0; i < attempts; i++) {
      try {
        const ok = await testSupabaseConnection();
        if (ok) return true;
      } catch (err) {
        // swallow and retry
      }
      // exponential backoff: 500ms, 1000ms, 2000ms...
      await delay(500 * Math.pow(2, i));
    }
    return false;
  };
  
  // Form submission
  const handleProfileUpdate = async () => {
    // Validate all fields
    const errors: FieldErrors = {
      firstName: !ValidationUtils.isValidName(formData.firstName, true),
      lastName: formData.lastName.length > 0 && !ValidationUtils.isValidName(formData.lastName, false),
      username: !ValidationUtils.isValidUsername(formData.username) || (!validation.usernameAvailable && formData.username !== userProfile?.username),
      birthDate: !ValidationUtils.isValidBirthDate(formData.birthDate),
    };
    
    validation.setFieldErrors(errors);
    
  if (Object.values(errors).some(Boolean)) return;
    
  setIsUpdating(true);
  try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) return;

      // If the user selected a new image preview, ensure Supabase is reachable, then upload it
      let profileImageUrl = userProfile?.profileImage ?? undefined;
      if (selectedImageUri) {
        const reachable = await ensureSupabaseReachable(3);
        if (!reachable) {
          console.error('Supabase unreachable before image upload');
          showNotification(t('profile.errors.upload_failed') || 'Network error — cannot reach server. Please check your connection and try again.', 'error');
          return;
        }
        try {
          const uploaded = await uploadToStorage(selectedImageUri, selectedImageBase64);
          // Append a cache-busting query param so all app images fetch the newest object
          if (uploaded) {
            // if URL already has params, add with & otherwise with ?
            const sep = uploaded.includes('?') ? '&' : '?';
            profileImageUrl = `${uploaded}${sep}v=${Date.now()}`;
          } else {
            profileImageUrl = undefined;
          }
        } catch (err) {
          console.error('Image upload failed during profile update:', err);
          showNotification(t('profile.errors.upload_failed'), 'error');
          return;
        }
      }

      const [d, m, y] = formData.birthDate.split('/');
      const formattedBirthDate = `${y}-${m}-${d}`;

      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: formData.firstName.trim(),
          last_name: formData.lastName.trim(),
          username: formData.username.trim(),
          birth_date: formattedBirthDate,
          ...(profileImageUrl ? { profile_image: profileImageUrl } : {}),
        })
        .eq('id', user.id);

      if (error) throw error;

      console.log('Profile DB update succeeded. uploaded profileImageUrl=', profileImageUrl);

      // Refresh context profile
      await fetchUserProfile();

      // Diagnostic: re-read profile row and list storage contents for user's folder
      try {
        const { data: profileRow, error: profErr } = await supabase
          .from('profiles')
          .select('profile_image')
          .eq('id', user.id)
          .single();
        console.log('profiles.profile_image after update:', profileRow?.profile_image, 'err=', profErr);
      } catch (e) {
        console.warn('Could not read profile row after update:', e);
      }

      try {
        const { data: listData, error: listErr } = await supabase.storage.from('avatars').list(`${user.id}/`);
        console.log('avatars list for user after update:', listData, 'err=', listErr);
      } catch (e) {
        console.warn('Could not list avatars after update:', e);
      }

      // Now clear local preview and base64 after successful update
      setSelectedImageUri(null);
      setSelectedImageBase64(null);
      setOriginalValues(formData);
      showNotification(t('profile.success.profile_updated'), 'success');
    } catch (err) {
      console.error('Error updating profile:', err);
      showNotification(t('profile.errors.update_failed_generic'), 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
  <Providers>
  <SafeAreaView style={styles.rootContainer}>
    <Animated.View style={{
      flex: 1,
      opacity: fadeOutAnim,
    }}>
      <View style={styles.notifBar} />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
            
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={() => doExit()} style={styles.iconTouch}>
                <Ionicons name="chevron-back" size={24} color="#4dccc1" />
              </TouchableOpacity>

              <Text style={styles.title} numberOfLines={1}>
                {t('profile.title')}
              </Text>

              <TouchableOpacity onPress={() => setShowLogoutModal(true)} style={styles.iconTouch}>
                <Ionicons name="log-out-outline" size={24} color="#4dccc1" />
              </TouchableOpacity>
            </View>

            {/* Avatar */}
              {
                // Prefer the server-stored public URL when present. Use local preview only when no remote URL exists.
                (() => {
                  const remote = userProfile?.profileImage;
                  const remoteIsHttp = typeof remote === 'string' && (remote.startsWith('http://') || remote.startsWith('https://'));
                  // Prefer the locally selected preview when present; otherwise fall back to the server URL.
                  const displayUri = selectedImageUri ?? (remoteIsHttp ? remote : (remote ?? null));
                  return (
                    <AvatarPicker
                      uri={displayUri}
                      onPick={() => setShowCropper(true)}
                      styles={styles}
                    />
                  );
                })()
              }

            {/* Form */}
            <View style={styles.form}>
              
              {/* Name fields */}
              <View style={styles.nameRow}>
                <View style={styles.nameField}>
                  <LockableField
                    styles={styles}
                    fieldKey="firstName"
                    activeField={activeField}
                    setActiveField={setActiveField}
                    value={formData.firstName}
                    onChangeText={(text: string) => handleNameChange('firstName', text)}
                    placeholder={t('auth.fields.name')}
                    error={getFieldError('firstName')}
                    isValid={isFieldValid('firstName') && hasFieldChanged('firstName')}
                    isPending={validation.isFieldPending('firstName')}
                    returnKeyType="next"
                    iconName="person-outline"
                  />
                  
                </View>
                
                <View style={styles.nameField}>
                  <LockableField
                    styles={styles}
                    fieldKey="lastName"
                    activeField={activeField}
                    setActiveField={setActiveField}
                    value={formData.lastName}
                    onChangeText={(text: string) => handleNameChange('lastName', text)}
                    placeholder={t('auth.fields.last_name')}
                    error={getFieldError('lastName')}
                    isValid={isFieldValid('lastName') && hasFieldChanged('lastName')}
                    isPending={validation.isFieldPending('lastName')}
                    returnKeyType="next"
                    iconName="person-outline"
                  />
                  
                </View>
              </View>

              {/* Birth date */}
              <BirthdateField
                styles={styles}
                fieldKey="birthDate"
                activeField={activeField}
                setActiveField={setActiveField}
                value={formData.birthDate}
                onChangeText={handleBirthDateChange}
                placeholder={t('auth.birthdate_placeholder')}
                error={getFieldError('birthDate')}
                isValid={isFieldValid('birthDate') && hasFieldChanged('birthDate')}
                isPending={validation.isFieldPending('birthDate')}
                returnKeyType="next"
              />
              

              {/* Username */}
              <LockableField
                styles={styles}
                fieldKey="username"
                activeField={activeField}
                setActiveField={setActiveField}
                prefix="@"
                value={formData.username}
                onChangeText={handleUsernameChange}
                placeholder={t('auth.fields.username')}
                error={getFieldError('username')}
                isValid={isFieldValid('username') && hasFieldChanged('username')}
                isPending={validation.isFieldPending('username') || validation.checkingUsername}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={20}
                returnKeyType="done"
              />
              

              {/* Action buttons */}
              <View style={styles.actionButtonsRow}>
                <TouchableOpacity activeOpacity={0.85} style={styles.actionButton} onPress={handleSendPasswordReset}>
                  <Ionicons name="key-outline" size={24} color={COLORS.accent} />
                  {sendingPasswordReset ? (
                    <ActivityIndicator size="small" color={COLORS.accent} />
                  ) : (
                    <Text style={styles.actionButtonText}>{t('profile.actions.change_password')}</Text>
                  )}
                </TouchableOpacity>
                
                <View style={{ width: 5 }} />
                
                <TouchableOpacity activeOpacity={0.85} style={styles.actionButton} onPress={handleStartEmailChange}>
                  <Ionicons name="mail-outline" size={24} color={COLORS.accent} />
                  <Text style={styles.actionButtonText}>{t('profile.actions.change_email')}</Text>
                </TouchableOpacity>
              </View>

              {/* Update button */}
              {(() => {
                const disabled = !isDirty || isUpdating;
                return (
                  <TouchableOpacity
                    activeOpacity={disabled ? 1 : 0.85}
                    accessibilityState={{ disabled }}
                    style={[
                      styles.button,
                        disabled ? { opacity: 0.6 } : {},
                        // Change border color when disabled so outline isn't bright cyan
                        disabled ? { borderColor: '#9CCFC8' } : { borderColor: '#4DCCC1' },
                      isUpdating ? { opacity: 0.9 } : {}
                    ]}
                    onPress={handleProfileUpdate}
                    disabled={disabled}
                  >
                    {isUpdating ? (
                      <ActivityIndicator size="small" color={COLORS.accent} />
                    ) : (
                      <Text style={disabled ? styles.buttonTextDisabled : styles.buttonText}>
                        {t('profile.buttons.update_profile') || 'Update'}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })()}
            </View>

            <LogoutConfirmationModal
              isVisible={showLogoutModal}
              onClose={() => setShowLogoutModal(false)}
              onLogout={async () => {
                await supabase.auth.signOut();
                router.replace('/(tabs)/ign-LoginScreen' as any);
              }}
            />

            {/* Image Cropper Modal */}
            {showCropper && (
              <Modal
                visible={true}
                transparent={true}
                animationType="fade"
                statusBarTranslucent
                onRequestClose={() => setShowCropper(false)}
              >
                <ImageCropperPopup onClose={() => setShowCropper(false)} onImageSelected={handleImageSelected} />
              </Modal>
            )}
            {showOtpPreview && (
              <Modal visible={true} transparent animationType="fade" statusBarTranslucent>
                <OTPpopup onClose={() => setShowOtpPreview(false)} onSubmit={(code: string) => {
                  console.log('OTP entered:', code);
                }} />
              </Modal>
            )}
            {/* Email change modal (styled like other modals: blurred backdrop, outlined card, translucent buttons) */}
            <Modal visible={emailModalVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setEmailModalVisible(false)}>
              <BlurView intensity={1200} tint={isDarkMode ? 'dark' : 'dark'} style={{ flex: 1 }}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                  <Animated.View style={{ width: '90%', backgroundColor: isDarkMode ? '#07201d' : '#fff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: COLORS.accent, transform: [{ translateY: Animated.multiply(animatedShift, -1) }] }}>
                    <Text style={{ color: COLORS.accent, fontSize: 16, marginBottom: 8, textAlign: 'center', fontWeight: '700' }}>{t('profile.dialogs.enter_new_email') || 'Enter new email address'}</Text>
                    <TextInput
                      value={newEmail}
                      onChangeText={setNewEmail}
                      placeholder={t('profile.placeholders.email') || 'you@example.com'}
                      placeholderTextColor={'#4A6563'}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      style={[{ height: 44, borderWidth: 1, borderColor: COLORS.accent, borderRadius: 8, paddingHorizontal: 10 }, { color: styles.input.color }]}
                    />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
                      {/* Cancel on left */}
                      <TouchableOpacity
                        onPress={() => setEmailModalVisible(false)}
                        style={{ minWidth: 92, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: COLORS.accent, backgroundColor: 'rgba(77,204,193,0.06)', alignItems: 'center' }}
                      >
                        <Text style={{ color: COLORS.accent, fontWeight: '600' }}>{t('common.cancel') || 'Cancel'}</Text>
                      </TouchableOpacity>

                      {/* Confirm on right with enable/disable state */}
                      <TouchableOpacity
                        onPress={handleConfirmEmailChange}
                        disabled={isConfirmDisabled}
                        accessibilityState={{ disabled: isConfirmDisabled }}
                        style={{
                          minWidth: 92,
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: isConfirmDisabled ? '#9CCFC8' : COLORS.accent,
                          backgroundColor: isConfirmDisabled ? 'rgba(77,204,193,0.03)' : 'rgba(77,204,193,0.06)',
                          alignItems: 'center',
                          opacity: isConfirmDisabled ? 0.7 : 1
                        }}
                      >
                        {sendingEmailChange ? (
                          <ActivityIndicator size="small" color={COLORS.accent} />
                        ) : (
                          <Text style={{ color: isConfirmDisabled ? '#9CCFC8' : COLORS.accent, fontWeight: '600' }}>{t('common.confirm') || 'Confirm'}</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </Animated.View>
                </View>
              </BlurView>
            </Modal>
          </ScrollView>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Animated.View>
  </SafeAreaView>
  </Providers>
  );
}

// Styles
const getThemedStyles = (isDark: boolean) => StyleSheet.create({
  rootContainer: { 
  flex: 1, 
  backgroundColor: isDark ? '#0A1E1C' : '#F7FFFC'
  },
  notifBar: { 
  height: 5, 
  backgroundColor: isDark ? '#0A1E1C' : '#F7FFFC', 
    width: '100%' 
  },
  scrollContainer: { 
  paddingTop: 0,
    paddingLeft: 20,
    paddingRight: 20,
    paddingBottom: 20,
  },
  header: { 
  width: '100%', 
  flexDirection: 'row', 
  alignItems: 'center', 
  justifyContent: 'space-between', 
  marginBottom: 6,
  marginTop: -8,
  paddingTop: 15,
  },
  iconTouch: { 
    padding: 8 
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4dccc1',
    textAlign: 'center',
    flex: 1,
  },
  imageContainer: { 
  alignItems: 'center', 
  marginBottom: 8,
    position: 'relative',
    width: SIZES.avatarSize,
    height: SIZES.avatarSize,
  // center avatar horizontally above the form
  alignSelf: 'center',
  marginLeft: 0,
  },
  avatarContainer: {
    width: SIZES.avatarSize,
    height: SIZES.avatarSize,
  // reduce rounding for profile picture (less circular)
  borderRadius: 60,
    borderWidth: 2,
    borderColor: '#80E6D9',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: isDark ? 'rgba(14, 46, 44, 0.85)' : 'rgba(255, 255, 255, 0.9)',
    zIndex: 1
  },
  avatar: { 
    width: SIZES.avatarInner, 
    height: SIZES.avatarInner, 
    borderRadius: 16,
    // Nudge slightly and scale up 2% to perfect centering
    transform: [
      { translateX: 1 },
      { translateY: 1 },
      { scale: 1.02 }
    ]
  },
  avatarPlaceholder: { 
    backgroundColor: 'rgba(128, 230, 217, 0.08)', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  cameraButton: {
    position: 'absolute',
    right: -5,
    bottom: -5,
    backgroundColor: '#4DCDC2',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: isDark ? '#0A1E1C' : '#F5F5F5',
    elevation: 2,
    zIndex: 2,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  lockButton: {
  marginLeft: 8,
  width: 36,
  height: 36,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'transparent',
  borderWidth: 0,
  },
  form: { 
    width: '100%', 
    maxWidth: Math.min(700, WINDOW.width - SIZES.padding * 2), 
    alignSelf: 'center', 
  gap: 8 
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 5,
  },
  nameField: {
    flex: 1,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#4DCCC1',
    borderRadius: 15,
  paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: isDark ? 'rgba(14, 46, 44, 0.85)' : 'rgba(255, 255, 255, 0.9)',
    color: isDark ? '#E5E7EB' : '#374151',
  },
  inputError: { 
    borderColor: '#EF4444', 
    borderWidth: 1 
  },
  validInput: { 
    borderColor: '#16A34A', 
    borderWidth: 1 
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    alignSelf: 'flex-start',
    lineHeight: 15,
  },
  errorSpacer: {
    minHeight: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    marginTop: 3,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDark ? 'rgba(14, 46, 44, 0.85)' : 'rgba(255, 255, 255, 0.9)',
    paddingVertical: 10,
    paddingHorizontal: 8,
  // Match form input borderRadius for visual consistency
  borderRadius: 15,
    borderWidth: 1,
    // Always use the app accent color for action button outlines
    borderColor: '#4DCCC1',
  },
  actionButtonText: {
  color: '#4DCCC1',
    fontSize: 14,
    marginLeft: 8,
    fontWeight: '500',
  },

  button: {
    height: 50,
    width: '100%',
    backgroundColor: isDark ? 'rgba(15,118,110,0.20)' : 'rgba(15,118,110,0.20)',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 3,
    paddingHorizontal: 12,
    borderWidth: 0.7,
    borderColor: '#4DCCC1',
  },
  buttonText: {
    color: '#4DCCC1',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextDisabled: {
    color: '#9CCFC8',
    fontSize: 16,
    fontWeight: '600',
  },
  notification: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: 20,
    padding: 12,
    borderRadius: 10,
    zIndex: 2000,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  notificationSuccess: {
    backgroundColor: isDark ? '#07201d' : '#E6FFFA',
    borderColor: '#0EA5A3',
    borderWidth: 1,
  },
  notificationError: {
    backgroundColor: isDark ? '#2b0a0a' : '#FFF1F2',
    borderColor: '#EF4444',
    borderWidth: 1,
  },
  notificationText: {
    fontSize: 14,
    textAlign: 'left',
  },
  notificationTextSuccess: {
    color: isDark ? '#80E6D9' : '#065f5a',
  },
  notificationTextError: {
    color: isDark ? '#FECACA' : '#88111a',
  },
});