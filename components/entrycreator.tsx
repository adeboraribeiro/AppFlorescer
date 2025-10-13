import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, DeviceEventEmitter, Dimensions, Keyboard, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { createEntry as createEntryLocal } from '../lib/entries';

type Props = {
  visible?: boolean;
  onClose?: () => void;
  // created entry may include an optional id when created locally
  onSave?: (entry: { id?: string; title: string; body?: string; date: string }) => void;
};

export default function EntryCreator({ visible = false, onClose, onSave }: Props) {
  const { theme } = useTheme();
  const router = useRouter();
  const isDark = theme === 'dark';
  const WINDOW = Dimensions.get('window');
  const animatedShift = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
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
  const [body, setBody] = useState('');
  // date as string in DD/MM/YYYY
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
      // start fade-out animation, then reset and notify host to unmount
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setRenderVisible(false);
        setTitle(''); setBody(''); setDateStr(formatDate(new Date())); setIsDateInvalid(false);
        // notify host that overlay finished hiding so it can remove the component
        try { DeviceEventEmitter.emit('globalOverlayHidden'); } catch (e) { /* ignore */ }
        onClose?.();
      });
      // also listen for external hide requests while hidden (no-op)
      hideSub = DeviceEventEmitter.addListener('globalOverlayHideRequest', () => {});
      return () => { hideSub?.remove(); };
    }
    // visible === true
    setRenderVisible(true);
    Animated.timing(fadeAnim, { toValue: 1, duration: 240, useNativeDriver: true }).start();

    // while visible, listen for host hide requests which should trigger fade-out
    hideSub = DeviceEventEmitter.addListener('globalOverlayHideRequest', () => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setRenderVisible(false);
        setTitle(''); setBody(''); setDateStr(formatDate(new Date())); setIsDateInvalid(false);
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

  const handleSave = () => {
    if (!title.trim()) return; // require title
    if (!isValidDateStr(dateStr)) {
      setIsDateInvalid(true);
      return;
    }
    // convert to ISO using parsed date
    const [d, m, y] = dateStr.split('/').map(Number);
    const iso = new Date(y, m - 1, d).toISOString();
    // generate a lightweight local id for immediate navigation; real backend should return canonical id
    const newId = `${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
    const payload = { id: newId, title: title.trim(), body: body.trim() || undefined, date: iso };
    // persist locally if host didn't handle onSave
    try {
      if (onSave) {
        onSave(payload);
      } else {
        createEntryLocal(payload as any);
      }
    } catch (e) { /* ignore */ }
    // navigate to edit page for the newly created entry
    try { router.push(`/(tabs)/edit-entry?id=${encodeURIComponent(newId)}`); } catch (e) { /* ignore navigation errors */ }
    // request host to hide overlay (host will emit hide request and then clear when overlay signals hidden)
    try { DeviceEventEmitter.emit('globalOverlayHideRequest'); } catch (e) { /* ignore */ }
  };

  const onChangeDateStr = (text: string) => {
    // mirror the login formatting: accept digits only and insert slashes
    const numbersOnly = text.replace(/\D/g, '');
    let formatted = '';
    if (numbersOnly.length > 0) {
      const day = numbersOnly.substring(0, 2);
      const month = numbersOnly.length > 2 ? numbersOnly.substring(2, 4) : '';
      const year = numbersOnly.length > 4 ? numbersOnly.substring(4, 8) : '';
      formatted = day; if (month) formatted += '/' + month; if (year) formatted += '/' + year;
    }
    setDateStr(formatted);
    // validate when full length
    if (formatted.length === 10) {
      const valid = isValidDateStr(formatted);
      setIsDateInvalid(!valid);
    } else {
      setIsDateInvalid(false);
    }
  };

  // Change the current date by deltaDays (positive or negative)
  const changeDateBy = (deltaDays: number) => {
    // parse current dateStr; if invalid, start from today
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

  const placeholderColor = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)';

  if (!renderVisible) return null;

  return (
    // root overlay must be absolutely positioned so it covers the full screen
    <Animated.View style={[styles.rootOverlay, { opacity: fadeAnim }]}>
      <BlurView intensity={1200} tint={isDark ? 'dark' : 'dark'} style={styles.backdrop}>
        <Animated.View style={[styles.card, { backgroundColor: isDark ? '#0A1E1C' : '#F7FFFC', borderColor: '#4DCDC1', transform: [{ translateY: Animated.multiply(animatedShift, -1) }] }]}>
        <Text style={[styles.title, { color: '#4DCDC1' }]}>New journal entry</Text>

          <TextInput placeholder="Title" placeholderTextColor={isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)'} value={title} onChangeText={setTitle} style={[styles.input, { color: isDark ? '#E5E7EB' : '#0A1E1C', borderColor: 'rgba(77,204,193,0.22)', backgroundColor: isDark ? 'rgba(77,204,193,0.02)' : 'rgba(77,204,193,0.02)', fontWeight: '600' }]} />

          <TextInput placeholder="Description (optional)" placeholderTextColor={isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)'} value={body} onChangeText={setBody} multiline numberOfLines={3} style={[styles.textarea, { color: isDark ? '#E5E7EB' : '#0A1E1C', borderColor: 'rgba(77,204,193,0.12)', backgroundColor: isDark ? 'rgba(77,204,193,0.01)' : 'rgba(77,204,193,0.01)', fontWeight: '500' }]} />        <View style={{ position: 'relative', width: '100%' }}>
          <TextInput
            placeholder="DD/MM/YYYY"
            placeholderTextColor={placeholderColor}
            value={dateStr}
            // disable direct typing; arrows control the value
            editable={false}
            maxLength={10}
                        style={[styles.input, styles.birthdateInput, { color: isDark ? '#E5E7EB' : '#0A1E1C', borderColor: isDateInvalid ? '#DC2626' : 'rgba(77,204,193,0.12)', backgroundColor: isDark ? 'rgba(77,204,193,0.01)' : 'rgba(77,204,193,0.01)', paddingRight: 64, textAlign: 'left', fontWeight: '600' }]}
          />

          {/* Right side: arrows vertically centered */}
          <TouchableOpacity
            onPress={() => changeDateBy(1)}
            style={[styles.arrowCircle, { position: 'absolute', right: 8, top: 11, zIndex: 10, backgroundColor: 'rgba(77,204,193,0.5)' }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-up" size={14} color={isDateInvalid ? '#DC2626' : '#4DCCC1'} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => changeDateBy(-1)}
            style={[styles.arrowCircle, { position: 'absolute', right: 46, top: 11, zIndex: 10, backgroundColor: 'rgba(77,204,193,0.5)' }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-down" size={14} color={isDateInvalid ? '#DC2626' : '#4DCCC1'} />
          </TouchableOpacity>
        </View>
        {isDateInvalid && <Text style={[styles.errorText, { marginBottom: 8 }]}>Invalid date</Text>}

  <View style={styles.actionsRow}>
          {/* Use exact same accent/bgs as the email modal: accent '#4DCCC1', enabled bg 'rgba(77,204,193,0.06)', disabled bg 'rgba(77,204,193,0.03)', disabled tint '#9CCFC8' */}
          <TouchableOpacity
            onPress={() => { try { DeviceEventEmitter.emit('globalOverlayHideRequest'); } catch (e) { /* ignore */ } }}
            style={{
              minWidth: 92,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: '#4DCDC1',
              backgroundColor: 'rgba(77,204,193,0.06)',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Text style={[styles.btnText, { color: '#4DCCC1' }]}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => { handleSave(); }}
            disabled={!title.trim() || isDateInvalid}
            accessibilityState={{ disabled: !title.trim() || isDateInvalid }}
            style={{
              minWidth: 92,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: (!title.trim() || isDateInvalid) ? '#9CCFC8' : '#4DCCC1',
              backgroundColor: (!title.trim() || isDateInvalid) ? 'rgba(77,204,193,0.03)' : 'rgba(77,204,193,0.06)',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: (!title.trim() || isDateInvalid) ? 0.8 : 1
            }}
          >
            {(!title.trim() || isDateInvalid) ? (
              <Text style={[styles.btnText, { color: '#9CCFC8' }]}>Create</Text>
            ) : (
              <Text style={[styles.btnText, { color: '#4DCCC1' }]}>Create</Text>
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>
      </BlurView>
  </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 20, zIndex: 99999,
  },
  card: {
  width: '100%', maxWidth: 340, borderRadius: 12, alignItems: 'stretch', padding: 16, borderWidth: 0.7,
  shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 50,
  alignSelf: 'center',
  },
  // add small top spacing for the title, keep field-to-field spacing unchanged
  title: { fontSize: 18, fontWeight: '700', textAlign: 'center', marginTop: 12, marginBottom: 12 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 16, marginBottom: 12 },
  textarea: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, minHeight: 80, textAlignVertical: 'top', marginBottom: 12 },
  // add extra bottom space after the date field so actions sit lower
  birthdateInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 16, marginBottom: 16 },
  errorText: { color: '#DC2626', fontSize: 13 },
  dateRow: { paddingVertical: 12, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(77,204,193,0.12)', marginBottom: 12 },
  dateText: { fontSize: 16, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  btn: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10, minWidth: 100, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { borderWidth: 1 },
  btnSecondary: { borderWidth: 1, backgroundColor: 'transparent' },
  btnText: { fontWeight: '700' },
  rootOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999,
  },
  arrowCircle: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginHorizontal: 4 },
  dot: { width: 4, height: 4, borderRadius: 2, opacity: 0.9 },
});
