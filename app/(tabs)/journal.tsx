import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, DeviceEventEmitter, Dimensions, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
// entcreator will be shown via the global overlay host in the tabs layout
import EntCreator from '../../components/entcreator';
import { useTheme } from '../../contexts/ThemeContext';

export default function Journal() {
  const { t } = useTranslation();
  const { width: windowWidth } = Dimensions.get('window');
  const slideAnim = useRef(new Animated.Value(windowWidth)).current;
  const shadowFade = useRef(new Animated.Value(0)).current;

  // background floating blobs
  const blob1 = useRef(new Animated.Value(0)).current;
  const blob2 = useRef(new Animated.Value(0)).current;
  const blob3 = useRef(new Animated.Value(0)).current;

  // card animations
  const [open, setOpen] = useState(false);
  const cardScale = useRef(new Animated.Value(0.92)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  // theme-aware colors (light/dark)
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const pageBgLight = '#ffffffff';
  const pageBgFinal = isDarkMode ? '#0A1E1C' : pageBgLight;
  // General scheme: text ALWAYS #4DCCC1, outlines alpha ALWAYS 0.7
  const generalText = '#4DCCC1';
  const outlineAlpha = 'rgba(77,204,193,0.7)';
  // stronger, more visible blob colors for light mode — increased alpha and opacity
  const blob1Color = isDarkMode ? '#4DCCC1' : 'rgba(77,204,193,0.5)';
  const blob2Color = isDarkMode ? '#7EF3E8' : 'rgba(126,243,232,0.44)';
  const blob3Color = isDarkMode ? '#2EBBAF' : 'rgba(46,187,175,0.48)';
  const blobOpacity = isDarkMode ? 0.18 : 0.6;
  const cardBg = isDarkMode ? 'rgba(255,255,255,0.04)' : '#ffffff';
  // enforce general text color on the journal screen
  const cardTitleColor = generalText;
  const cardBodyColor = generalText;
  // 1-state button: outline & text #4DCCC1, outline alpha 0.7
  const cardButtonBg = isDarkMode ? 'rgba(15, 118, 109, 0.50)' : 'rgba(15,118,109,0.50)';
  const cardButtonText = generalText;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(shadowFade, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start();

    // floating blobs loop
    Animated.loop(Animated.sequence([
      Animated.timing(blob1, { toValue: -12, duration: 3000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(blob1, { toValue: 0, duration: 3000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ])).start();

    Animated.loop(Animated.sequence([
      Animated.timing(blob2, { toValue: -8, duration: 3600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(blob2, { toValue: 0, duration: 3600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ])).start();

    Animated.loop(Animated.sequence([
      Animated.timing(blob3, { toValue: -18, duration: 4200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(blob3, { toValue: 0, duration: 4200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ])).start();

    // subtle card entrance
    Animated.parallel([
      Animated.timing(cardScale, { toValue: 1, duration: 360, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
    ]).start();
  }, []);
    // return with card as main element
  const onPressCard = () => {
    // placeholder: open entry editor or expand further
  };

  const handleSaveEntry = (entry: { title: string; body?: string; date: string }) => {
    // TODO: persist via service; for now just console.log
    console.log('saved entry', entry);
    // request host to hide overlay (host will relay request to overlay which will animate out)
    try { DeviceEventEmitter.emit('globalOverlayHideRequest'); } catch (e) { /* ignore */ }
  };
  const openCreator = () => {
    try {
      DeviceEventEmitter.emit('globalOverlayShow', { component: EntCreator, props: { visible: true, onSave: handleSaveEntry } });
    } catch (e) { console.warn('failed to emit overlay show', e); }
  };

  return (
    <Animated.View style={[styles.container, { transform: [{ translateX: slideAnim }], backgroundColor: pageBgFinal }]}>
      {/* decorative background blobs */}
  <Animated.View style={[styles.blob, styles.blob1, { transform: [{ translateY: blob1 }], backgroundColor: blob1Color, opacity: blobOpacity }]} />
  <Animated.View style={[styles.blob, styles.blob2, { transform: [{ translateY: blob2 }], backgroundColor: blob2Color, opacity: blobOpacity }]} />
  <Animated.View style={[styles.blob, styles.blob3, { transform: [{ translateY: blob3 }], backgroundColor: blob3Color, opacity: blobOpacity }]} />

      <View style={{ flex: 1 }}>
        <View style={styles.centerArea}>
          <Animated.View style={[styles.card, { transform: [{ scale: cardScale }], opacity: cardOpacity, backgroundColor: cardBg, borderColor: outlineAlpha }]}>
            <Ionicons name="pencil" size={28} color={generalText} style={{ marginBottom: 10 }} />
            <Text style={[styles.cardTitle, { color: cardTitleColor }]}>{t('journal.intro_title')}</Text>
            <Text style={[styles.cardBody, { color: cardBodyColor }]}>{t('journal.intro_body')}</Text>
            <TouchableOpacity style={[styles.cardButton, { backgroundColor: cardButtonBg, borderWidth: 1, borderColor: outlineAlpha }]} onPress={openCreator}>
              <Text style={[styles.cardButtonText, { color: cardButtonText }]}>{t('journal.write_button')}</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
        {/* Bottom spacer: reserve blank area so centerArea stays centered above it */}
        <View style={styles.bottomBlock} />
      </View>
  {/* entcreator is shown via the global overlay host in the tabs layout */}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 18, letterSpacing: 0.6 },
  blob: { position: 'absolute', borderRadius: 100, opacity: 0.18 },
  blob1: { width: 220, height: 220, top: 40, left: -40 },
  blob2: { width: 160, height: 160, bottom: 140, right: -30 },
  blob3: { width: 120, height: 120, top: 160, right: 40 },
  fabWrap: { alignItems: 'center', justifyContent: 'center', marginVertical: 12 },
  ring: { position: 'absolute', width: 140, height: 140, borderRadius: 70, borderWidth: 2, borderColor: 'rgba(159,240,230,0.12)' },
  fab: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, elevation: 6 },
  card: { marginTop: 20, width: '86%', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1 },
  cardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  cardBody: { fontSize: 14, textAlign: 'center', marginBottom: 12 },
  cardButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  cardButtonText: { fontWeight: '700' },
  bottomBlock: { height: 100, width: '100%' },
});