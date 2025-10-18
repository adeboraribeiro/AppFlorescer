import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSegments } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, DeviceEventEmitter, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useSafeUserData } from './SafeUserDataProvider';

// KeyChecker now prompts the user to set a passkey when none exists.
// It never exposes the passkey; it only saves it via `setPasskey` in the provider.
export default function KeyChecker() {
  const { userId, getPasskeyExists, setPasskey } = useSafeUserData();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const isDark = theme === 'dark';
  const segments = useSegments();

  const [showModal, setShowModal] = useState(false);
  const [passkeyInput, setPasskeyInput] = useState('');
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
  // If app is currently showing the splash route, do not run the check yet.
    // We consider splash active when segments include 'index' or when the only
    // segment is the '(tabs)' group. Wait until segments change to perform the check.
    const inSplash = (() => {
      try {
        if (!segments) return false;
        const segs: string[] = Array.isArray(segments) ? (segments as any as string[]) : [];
        if (segs.includes('index')) return true;
        if (segs.length === 1 && segs[0] === '(tabs)') return true;
        return false;
      } catch (e) { return false; }
    })();

    if (inSplash) {
      // defer checking; will re-run effect when segments change
      if (mounted) setChecking(false);
      return () => { mounted = false; };
    }

    // If there is no user yet, skip the passkey check and wait until userId is set
    if (!userId) {
      if (mounted) setChecking(false);
      return () => { mounted = false; };
    }

    (async () => {
      try {
        const exists = await getPasskeyExists();
        if (mounted && !exists) setShowModal(true);
      } catch (e) {
        // If getPasskeyExists threw because there's no user, ignore and do not show the modal.
        const msg = e && (e as any).message ? (e as any).message : String(e);
        if (msg && msg.toLowerCase().includes('no user')) {
          // ignore
        } else {
          console.warn('getPasskeyExists error:', e);
          if (mounted) setShowModal(true);
        }
      } finally {
        if (mounted) setChecking(false);
      }
    })();
    return () => { mounted = false; };
  }, [getPasskeyExists, segments, userId]);

  // Listen for external requests to force-open the KeyChecker modal (debug)
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('forceOpenKeyChecker', () => {
      try {
        setShowModal(true);
      } catch (e) { /* ignore */ }
    });
    return () => { try { sub.remove(); } catch (e) { /* ignore */ } };
  }, []);

  const onSave = async () => {
    const v = passkeyInput.trim();
    if (v.length < 4) {
      Alert.alert(t('journal.passkey_invalid_title', 'Invalid passkey'), t('journal.passkey_invalid', 'Passkey must be at least 4 characters long'));
      return;
    }
    try {
      await setPasskey(v);
      setShowModal(false);
    } catch (e) {
      const msg = (e && (e as any).message) ? (e as any).message : String(e);
      Alert.alert(t('journal.save_passkey_failed', 'Failed to save passkey'), msg);
    }
  };

  if (checking) return null;

  return (
    <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <BlurView intensity={1200} tint={isDark ? 'dark' : 'light'} style={styles.backdrop}>
          <View style={[styles.card, { backgroundColor: isDark ? '#0A1E1C' : '#F7FFFC', borderColor: '#4dccc1' }]}> 
            <View style={styles.headerSection}>
              <View style={styles.iconCircle}>
                <Ionicons name="key-outline" size={24} color="#4DCDC1" />
              </View>
              <Text style={[styles.title, { color: '#4DCDC1' }]}>{t('journal.set_passkey_prompt', 'Set a passkey to encrypt your journal')}</Text>
            </View>

            <View style={styles.formSection}>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={18} color="#4dccc1" style={styles.inputIcon} />
                <TextInput
                  placeholder={t('journal.enter_passkey', 'Enter passkey')}
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
                  value={passkeyInput}
                  onChangeText={setPasskeyInput}
                  secureTextEntry
                  style={[styles.input, { color: isDark ? '#E5E7EB' : '#0A1E1C', borderColor: '#4dccc1', backgroundColor: isDark ? 'rgba(77,204,193,0.05)' : 'rgba(77,204,193,0.05)', paddingLeft: 44 }]}
                />
              </View>
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity
                onPress={() => { setShowModal(false); }}
                style={[styles.button, { borderWidth: 1.5, borderColor: '#4dccc1', backgroundColor: isDark ? 'rgba(77,204,193,0.15)' : 'rgba(77,204,193,0.15)' }]}
              >
                <Text style={[styles.btnText, { color: '#4DCCC1' }]}>{t('common.cancel', 'Cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onSave}
                style={[styles.button, { borderWidth: 1.5, borderColor: passkeyInput.trim().length < 4 ? 'rgba(77,204,193,0.2)' : '#4DCDC1', backgroundColor: passkeyInput.trim().length < 4 ? 'rgba(77,204,193,0.08)' : 'rgba(77,204,193,0.15)', opacity: passkeyInput.trim().length < 4 ? 0.7 : 1 }]}
              >
                <Text style={[styles.btnText, { color: passkeyInput.trim().length < 4 ? '#9CCFC8' : '#4DCCC1' }]}>{t('journal.save_passkey', 'Save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    alignItems: 'stretch',
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 8,
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
    fontSize: 16,
    fontWeight: '700',
    color: '#4DCDC1',
    letterSpacing: 0.3,
  },
  formSection: {
    marginTop: 6,
    marginBottom: 12,
  },
  inputWrapper: {
    position: 'relative',
    marginTop: 8,
  },
  inputIcon: {
    position: 'absolute',
    left: 12,
    top: 12,
    zIndex: 2,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    paddingLeft: 44,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  btnText: {
    fontWeight: '700',
    color: '#4DCCC1',
  }
});
