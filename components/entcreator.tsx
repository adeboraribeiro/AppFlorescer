import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, DeviceEventEmitter, Dimensions, Keyboard, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useSafeUserData } from './SafeUserDataProvider';

type Props = {
  visible?: boolean;
  onClose?: () => void;
  onSave?: (entry: { id?: string; title: string; body?: string; date: string }) => void;
};

export default function EntCreator({ visible = false, onClose, onSave }: Props) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const isDark = theme === 'dark';
  const WINDOW = Dimensions.get('window');
  const animatedShift = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const [renderVisible, setRenderVisible] = useState<boolean>(visible);
  
  useEffect(() => {
    const eventShow = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const eventHide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: any) => {
      const h = e?.endCoordinates?.height ?? 300;
      const target = Math.min(h * 0.21, WINDOW.height * 0.17);
      Animated.spring(animatedShift, { toValue: target, tension: 40, friction: 9, useNativeDriver: true }).start();
    };
    const onHide = () => Animated.spring(animatedShift, { toValue: 0, tension: 40, friction: 9, useNativeDriver: true }).start();

    const showSub = Keyboard.addListener(eventShow, onShow);
    const hideSub = Keyboard.addListener(eventHide, onHide);
    return () => { showSub.remove(); hideSub.remove(); };
  }, [animatedShift]);

  const [title, setTitle] = useState('');
  
  // Generate default title when the creator opens
  const { listJournalEntries, getCachedCategory } = useSafeUserData();

  useEffect(() => {
    if (visible) {
      // Compute the next sequential entry number using cached entries synchronously when possible
      (async () => {
        let nextNumber = Math.floor(Date.now() / 1000) % 100000; // fallback
        try {
          try {
            const cached = getCachedCategory('journal');
            if (cached && typeof cached === 'object') {
              nextNumber = Object.keys(cached).length + 1;
            }
          } catch (e) { /* ignore cache usage errors */ }

          // If cache did not provide a count, fall back to async listing
          if (!nextNumber || nextNumber < 1) {
            const list = await listJournalEntries();
            if (Array.isArray(list)) nextNumber = list.length + 1;
          }
        } catch (e) {
          // ignore and use fallback
        }
        setEntryNumber(nextNumber);
        const baseWord = t('entry.new').toLowerCase().startsWith('new') ? 'Entry' : 'Registro';
        setTitle(`${baseWord} ${nextNumber}`.slice(0, 64));
      })();
    }
  }, [visible, t, listJournalEntries]);

  // Keep track of the entry number
  const [entryNumber, setEntryNumber] = useState<number>(0);

  const formatDate = (d: Date) => {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = String(d.getFullYear());
    return `${dd}/${mm}/${yyyy}`;
  };

  const [dateStr, setDateStr] = useState<string>(formatDate(new Date()));
  const [isDateInvalid, setIsDateInvalid] = useState(false);

  useEffect(() => {
    let hideSub: any;
    if (!visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 0.92, duration: 200, useNativeDriver: true })
      ]).start(() => {
        setRenderVisible(false);
          setTitle(''); 
          setDateStr(formatDate(new Date())); 
        setIsDateInvalid(false);
        try { DeviceEventEmitter.emit('globalOverlayHidden'); } catch (e) { /* ignore */ }
        onClose?.();
      });
      hideSub = DeviceEventEmitter.addListener('globalOverlayHideRequest', () => {});
      return () => { hideSub?.remove(); };
    }
    
    setRenderVisible(true);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 240, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 8, useNativeDriver: true })
    ]).start();

    hideSub = DeviceEventEmitter.addListener('globalOverlayHideRequest', () => {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 0.92, duration: 200, useNativeDriver: true })
      ]).start(() => {
  setRenderVisible(false);
  setTitle(''); 
  setDateStr(formatDate(new Date())); 
        setIsDateInvalid(false);
        try { DeviceEventEmitter.emit('globalOverlayHidden'); } catch (e) { /* ignore */ }
        onClose?.();
      });
    });
    return () => { hideSub?.remove(); };
  }, [visible]);

  const isValidDateStr = (s: string) => {
    const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    if (!dateRegex.test(s)) return false;
    const [day, month, year] = s.split('/').map(Number);
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    const d = new Date(year, month - 1, day);
    if (!(d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day)) return false;
    return true;
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    if (!isValidDateStr(dateStr)) {
      setIsDateInvalid(true);
      return;
    }
    const [d, m, y] = dateStr.split('/').map(Number);
    const iso = new Date(y, m - 1, d).toISOString();
    
    if (onSave) {
      onSave({ title: title.trim(), date: iso });
    } else {
      try {
        // Navigate to editor with title, date, and entry number
        router.push(`/(tabs)/ent-editor?title=${encodeURIComponent(title.trim())}&date=${encodeURIComponent(iso)}&number=${entryNumber}`);
      } catch (e) { /* ignore navigation errors */ }
    }
  };

  const onChangeDateStr = (text: string) => {
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
    setDateStr(formatted);
    if (formatted.length === 10) {
      const valid = isValidDateStr(formatted);
      setIsDateInvalid(!valid);
    } else {
      setIsDateInvalid(false);
    }
  };

  const changeDateBy = (deltaDays: number) => {
    let baseDate: Date;
    if (isValidDateStr(dateStr)) {
      const [d, m, y] = dateStr.split('/').map(Number);
      baseDate = new Date(y, m - 1, d);
    } else {
      baseDate = new Date();
    }
    const next = new Date(baseDate.getTime());
    next.setDate(next.getDate() + deltaDays);
    const newStr = formatDate(next);
    setDateStr(newStr);
    setIsDateInvalid(!isValidDateStr(newStr));
  };

  const placeholderColor = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';

  if (!renderVisible) return null;

  return (
    <Animated.View style={[styles.rootOverlay, { opacity: fadeAnim }]}> 
      <BlurView intensity={1200} tint={isDark ? 'dark' : 'light'} style={styles.backdrop}>
        <Animated.View 
          style={[
            styles.card, 
            { 
              backgroundColor: isDark ? '#0A1E1C' : '#F7FFFC', 
              borderColor: '#4DCDC1', 
              transform: [
                { translateY: Animated.multiply(animatedShift, -1) },
                { scale: scaleAnim }
              ] 
            }
          ]}
        >
          <View style={styles.headerSection}>
            <View style={styles.iconCircle}>
              <Ionicons name="book-outline" size={24} color="#4DCDC1" />
            </View>
            <Text style={[styles.title, { color: '#4DCDC1' }]}>{t('entry.new')}</Text>
            
          </View>

          <View style={styles.formSection}>
            <View style={styles.inputWrapper}>
              <Ionicons 
                name="text-outline" 
                size={18} 
                color={isDark ? '#4dccc1' : '#4dccc1'} 
                style={styles.inputIcon}
              />
              <TextInput 
                placeholder={t('entry.entry_title')} 
                placeholderTextColor={placeholderColor} 
                value={title} 
                onChangeText={(text) => setTitle(text.slice(0, 64))} 
                maxLength={64}
                style={[
                  styles.input, 
                  { 
                    color: isDark ? '#E5E7EB' : '#0A1E1C', 
                    borderColor: '#4dccc1', 
                    backgroundColor: isDark ? 'rgba(77,204,193,0.05)' : 'rgba(77,204,193,0.05)', 
                    fontWeight: '600',
                    paddingLeft: 44
                  }
                ]} 
              />
            </View>

            
            
            <View style={[styles.inputWrapper, { position: 'relative' }]}>
              <Ionicons 
                name="calendar-outline" 
                size={18} 
                color={isDark ? '#4dccc1' : '#4dccc1'} 
                style={styles.inputIcon}
              />
              <TextInput
                placeholder={t('entry.date_placeholder')}
                placeholderTextColor={placeholderColor}
                value={dateStr}
                editable={false}
                maxLength={10}
                style={[
                  styles.input, 
                  styles.birthdateInput, 
                  { 
                    color: isDark ? '#E5E7EB' : '#0A1E1C', 
                    borderColor: isDateInvalid ? '#DC2626' : '#4dccc1', 
                    backgroundColor: isDark ? 'rgba(77,204,193,0.05)' : 'rgba(77,204,193,0.05)', 
                    paddingRight: 80, 
                    paddingLeft: 44,
                    textAlign: 'left', 
                    fontWeight: '600' 
                  }
                ]}
              />

              <View style={styles.arrowContainer}>
                <TouchableOpacity
                  onPress={() => changeDateBy(-1)}
                  style={[
                    styles.arrowCircle, 
                    { 
                      backgroundColor: isDark ? 'rgba(77,204,193,0.15)' : 'rgba(77,204,193,0.2)',
                      borderWidth: 1,
                      borderColor: '#4dccc1'
                    }
                  ]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="chevron-down" size={16} color="#4DCCC1" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => changeDateBy(1)}
                  style={[
                    styles.arrowCircle, 
                    { 
                      backgroundColor: isDark ? 'rgba(77,204,193,0.15)' : 'rgba(77,204,193,0.2)',
                      borderWidth: 1,
                      borderColor: '#4dccc1'
                    }
                  ]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="chevron-up" size={16} color="#4DCCC1" />
                </TouchableOpacity>
              </View>
            </View>
            
            {isDateInvalid && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={16} color="#DC2626" />
                <Text style={styles.errorText}>{t('entry.invalid_date')}</Text>
              </View>
            )}
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              onPress={() => { 
                try { 
                  DeviceEventEmitter.emit('globalOverlayHideRequest'); 
                } catch (e) { /* ignore */ } 
              }}
              style={[
                styles.button,
                {
                  borderWidth: 1.5,
                  borderColor: '#4dccc1',
                  backgroundColor: isDark ? 'rgba(77,204,193,0.15)' : 'rgba(77,204,193,0.15)'
                }
              ]}
            >
              <Text style={[styles.btnText, { color: '#4DCCC1' }]}>{t('common.cancel').trim()}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => { handleSave(); }}
              disabled={!title.trim() || isDateInvalid}
              accessibilityState={{ disabled: !title.trim() || isDateInvalid }}
              style={[
                styles.button,
                {
                  borderWidth: 1.5,
                  borderColor: (!title.trim() || isDateInvalid) ? 'rgba(77,204,193,0.2)' : '#4DCDC1',
                  backgroundColor: (!title.trim() || isDateInvalid) ? 'rgba(77,204,193,0.08)' : 'rgba(77,204,193,0.15)',
                  opacity: (!title.trim() || isDateInvalid) ? 0.6 : 1
                }
              ]}
            >
                <Text style={[styles.btnText, { color: (!title.trim() || isDateInvalid) ? '#9CCFC8' : '#4DCCC1' }]}> 
                {t('entry.create')}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </BlurView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  rootOverlay: {
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    bottom: 0, 
    zIndex: 99999,
  },
  backdrop: {
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    bottom: 0, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 20, 
    zIndex: 99999,
  },
  card: {
    width: '100%', 
    maxWidth: 380, 
    borderRadius: 20, 
    alignItems: 'stretch', 
    padding: 24, 
    borderWidth: 1.5,
    shadowColor: '#000000', 
  shadowOffset: { width: 0, height: 0 }, 
  shadowOpacity: 0, 
  shadowRadius: 0, 
  elevation: 0,
    alignSelf: 'center',
  },
  headerSection: {
  alignItems: 'center',
  marginBottom: 12,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(77,204,193,0.15)',
    borderWidth: 2,
    borderColor: '#4DCDC1',
    alignItems: 'center',
    justifyContent: 'center',
  marginBottom: 8,
  },
  title: { 
    fontSize: 22, 
    fontWeight: '700', 
    textAlign: 'center', 
  marginBottom: 4,
    letterSpacing: 0.3
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0.2
  },
  formSection: {
    marginBottom: 12,
  },
  inputWrapper: {
    position: 'relative',
    marginBottom: 14,
  },
  inputIcon: {
    position: 'absolute',
    left: 14,
    top: 18,
    zIndex: 1,
  },
  input: { 
    borderWidth: 1.5, 
    borderRadius: 12, 
    paddingHorizontal: 14, 
    paddingVertical: 16,
    fontSize: 15,
  },
  textarea: { 
    borderWidth: 1.5, 
    borderRadius: 12, 
    paddingHorizontal: 14, 
    paddingVertical: 14, 
    minHeight: 100, 
    textAlignVertical: 'top',
    fontSize: 15,
    lineHeight: 22,
  },
  birthdateInput: { 
    marginBottom: 0
  },
  arrowContainer: {
    position: 'absolute',
    right: 10,
    top: 10,
    flexDirection: 'row',
    gap: 6,
    zIndex: 10,
  },
  arrowCircle: { 
    width: 34, 
    height: 34, 
    borderRadius: 17, 
    alignItems: 'center', 
    justifyContent: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  errorText: { 
    color: '#DC2626', 
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  actionsRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 4,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  btnText: { 
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.3
  },
});