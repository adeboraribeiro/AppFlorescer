import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, DeviceEventEmitter, Dimensions, Easing, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ConfirmDeletionModal from '../../components/ConfirmDeletionModal';
import EntCreator from '../../components/entcreator';
import { useTheme } from '../../contexts/ThemeContext';
import entryStore, { Entry, EntryStore } from '../../lib/entries';

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
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [entryToDelete, setEntryToDelete] = useState<Entry | null>(null);

  // Load entries when the screen mounts or becomes active
  useEffect(() => {
    const loadEntries = async () => {
      setLoading(true);
      try {
        const list = await entryStore.listEntries();
        setEntries(list);
      } catch (e) {
        console.warn('Failed to load entries:', e);
      } finally {
        setLoading(false);
      }
    };
    loadEntries();

    // Refresh entries when creating new ones
    const refreshSub = DeviceEventEmitter.addListener('refreshEntries', loadEntries);
    return () => refreshSub.remove();
  }, []);
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

  const handleSaveEntry = async (entry: { title: string; body?: string; date: string }) => {
    // Title must not be empty
    if (!entry.title.trim()) {
      return;
    }

    try {
      // Instead of creating the entry here, just navigate to editor with initial title
      router.push(`/(tabs)/ent-editor?title=${encodeURIComponent(entry.title.trim())}&date=${encodeURIComponent(entry.date)}`);
      DeviceEventEmitter.emit('globalOverlayHideRequest');
    } catch (e) {
      console.warn('Failed to navigate:', e);
    }
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
        {entries.length === 0 ? (
          // Show intro card if no entries
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
        ) : (
          // Show entries list if we have entries
          <View style={styles.listContainer}>
            <FlatList
              data={entries}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <View style={[styles.entryCard, { 
                    backgroundColor: cardBg,
                    borderColor: outlineAlpha
                  }]}> 
                  <TouchableOpacity
                    style={styles.entryCardContent}
                    onPress={() => router.push(`/(tabs)/ent-editor?id=${item.id}`)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.entryTitle, { color: cardTitleColor }]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={[styles.entryDate, { color: cardBodyColor }]} numberOfLines={1}>
                      {EntryStore.formatDisplayDate(item.date)}
                    </Text>
                    {item.body && (
                      <Text style={[styles.entryPreview, { color: cardBodyColor }]} numberOfLines={1}>
                        {item.body.split('\n')[0]}
                      </Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.deleteButton, { borderColor: outlineAlpha }]}
                    onPress={() => setEntryToDelete(item)}
                    accessibilityLabel={t('journal.delete_entry_title')}
                    accessibilityRole="button"
                  >
                    <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
                  </TouchableOpacity>
                </View>
              )}
            />
            <TouchableOpacity 
              style={[styles.fab, { backgroundColor: cardButtonBg, borderColor: outlineAlpha }]}
              onPress={openCreator}
            >
              <Ionicons name="add" size={32} color={cardButtonText} />
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.bottomBlock} />
      </View>
      
      <ConfirmDeletionModal
        isVisible={!!entryToDelete}
        onClose={() => setEntryToDelete(null)}
        onConfirm={() => {
          if (entryToDelete) {
            entryStore.deleteEntry(entryToDelete.id).then(() => {
              setEntries(entries.filter(e => e.id !== entryToDelete.id));
              setEntryToDelete(null);
            });
          }
        }}
        title={t('journal.delete_confirm')}
        message={t('journal.delete_entry_message')}
      />
      
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
  fab: { 
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56, 
    height: 56, 
    borderRadius: 28,
    alignItems: 'center', 
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  card: { marginTop: 20, width: '86%', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1 },
  cardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  cardBody: { fontSize: 14, textAlign: 'center', marginBottom: 12 },
  cardButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  cardButtonText: { fontWeight: '700' },
  bottomBlock: { height: 100, width: '100%' },
  listContainer: { flex: 1 },
  listContent: { padding: 16 },
  entryCard: {
    flexDirection: 'row',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  entryCardContent: {
    flex: 1,
    padding: 16,
  },
  deleteButton: {
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    backgroundColor: 'rgba(255,107,107,0.1)',
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  entryTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    marginRight: 12,
  },
  entryDate: {
    fontSize: 14,
  },
  entryPreview: {
    fontSize: 14,
    lineHeight: 20,
  },
});