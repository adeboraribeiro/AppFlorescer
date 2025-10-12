import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function Journal() {
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

  return (
    <Animated.View style={[styles.container, { transform: [{ translateX: slideAnim }] }]}>
      {/* decorative background blobs */}
      <Animated.View style={[styles.blob, styles.blob1, { transform: [{ translateY: blob1 }] }]} />
      <Animated.View style={[styles.blob, styles.blob2, { transform: [{ translateY: blob2 }] }]} />
      <Animated.View style={[styles.blob, styles.blob3, { transform: [{ translateY: blob3 }] }]} />

      <View style={{ flex: 1 }}>
        <View style={styles.centerArea}>
          <Animated.View style={[styles.card, { transform: [{ scale: cardScale }], opacity: cardOpacity }]}>
            <Ionicons name="pencil" size={28} color="#E8FFFB" style={{ marginBottom: 10 }} />
            <Text style={styles.cardTitle}>Try journaling</Text>
            <Text style={styles.cardBody}>Journaling is a simple, therapeutic practice that helps you process emotions, reduce stress, and notice patterns over time. Try writing a quick entry — even a few sentences can bring clarity and calm.</Text>
            <TouchableOpacity style={styles.cardButton} onPress={onPressCard}>
              <Text style={styles.cardButtonText}>Write</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
        {/* Bottom spacer: reserve blank area so centerArea stays centered above it */}
        <View style={styles.bottomBlock} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#081917' },
  centerArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  title: { color: '#9FF0E6', fontSize: 28, fontWeight: '800', marginBottom: 18, letterSpacing: 0.6 },
  blob: { position: 'absolute', borderRadius: 100, opacity: 0.18 },
  blob1: { width: 220, height: 220, backgroundColor: '#4DCCC1', top: 40, left: -40 },
  blob2: { width: 160, height: 160, backgroundColor: '#7EF3E8', bottom: 140, right: -30 },
  blob3: { width: 120, height: 120, backgroundColor: '#2EBBAF', top: 160, right: 40 },
  fabWrap: { alignItems: 'center', justifyContent: 'center', marginVertical: 12 },
  ring: { position: 'absolute', width: 140, height: 140, borderRadius: 70, borderWidth: 2, borderColor: 'rgba(159,240,230,0.12)' },
  fab: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#9FF0E6', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, elevation: 6 },
  card: { marginTop: 20, width: '86%', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#4DCCC1' },
  cardTitle: { color: '#E8FFFB', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  cardBody: { color: 'rgba(232,255,251,0.9)', fontSize: 14, textAlign: 'center', marginBottom: 12 },
  cardButton: { backgroundColor: '#4DCCC1', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  cardButtonText: { color: '#07231F', fontWeight: '700' },
  bottomBlock: { height: 100, width: '100%' },
});