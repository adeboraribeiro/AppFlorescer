import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  BackHandler,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
// Accept enabledModules from parent to avoid require cycle with app/(tabs)/_layout
import { useTheme } from '../contexts/ThemeContext';

interface MoreModulesModalProps {
  isVisible: boolean;
  onClose: () => void;
  // list of enabled modules (ordered) provided by parent; parent should pass the same shape as AVAILABLE_MODULES entries
  enabledModules?: Array<{ id: string; labelKey: string; icon?: string; route?: string }>;
}

export default function MoreModulesModal({ isVisible, onClose, enabledModules }: MoreModulesModalProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const [modules, setModules] = useState<Array<any>>([]);
  const [page, setPage] = useState(0);
  const pageAnim = useRef(new Animated.Value(0)).current;
  const arrowScaleRefs = useRef({ left: new Animated.Value(1), right: new Animated.Value(1) });

  useEffect(() => {
    if (!isVisible) return;
    let mounted = true;
    // Parent provides enabledModules as an ordered array of module objects (matching AVAILABLE_MODULES shape).
    // Show enabled modules that are beyond the first 4 (0..3 are shown on tab bar)
    try {
      const enabledOrdered = (enabledModules || []).map(m => m && m.id ? m.id : String(m)).filter(Boolean);
      const extra = enabledOrdered.slice(4).map(id => (enabledModules || []).find(m => m.id === id)).filter(Boolean) as any[];
      if (mounted) setModules(extra);
    } catch (e) {
      if (mounted) setModules([]);
    }
    return () => { mounted = false; };
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;
    const onBack = () => {
      onClose();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [isVisible, onClose]);
  const handleModulePress = useCallback((mod: any) => {
    onClose();
    if (mod && mod.route) {
      try { router.push(mod.route); } catch (e) { /* ignore */ }
    }
  }, [onClose]);

  // Pagination: 4 items per page (2x2 grid)
  const ITEMS_PER_PAGE = 4;
  const totalPages = Math.max(1, Math.ceil(modules.length / ITEMS_PER_PAGE));
  const pageSafe = Math.max(0, Math.min(page, totalPages - 1));
  const visibleModules = modules.slice(pageSafe * ITEMS_PER_PAGE, pageSafe * ITEMS_PER_PAGE + ITEMS_PER_PAGE);

  useEffect(() => {
    // reset page when modules change
  setPage(0);
  // reset animated position
  pageAnim.setValue(0);
  }, [modules.length]);

  if (!isVisible) return null;

  const modalBackground = isDarkMode ? '#0A1E1C' : '#FFFFFF';
  const nodeBackground = isDarkMode ? '#0A1E1C' : '#FFFFFF';
  const textColor = '#4dccc1';
  const backdropStyle = [StyleSheet.absoluteFill, { backgroundColor: modalBackground, opacity: isDarkMode ? 0.85 : 0.45 }];
  const containerStyle = [styles.modalContainer, { backgroundColor: nodeBackground, borderColor: isDarkMode ? '#4dccc194' : '#4dccc1' }];

  const CONTENT_WIDTH = 360; // modalContainer width
  const CONTENT_INNER = CONTENT_WIDTH - 48; // account for modal padding (24 + 24)

  const animateArrow = (which: 'left' | 'right') => {
    const ref = which === 'left' ? arrowScaleRefs.current.left : arrowScaleRefs.current.right;
    Animated.sequence([
      Animated.timing(ref, { toValue: 0.86, duration: 100, useNativeDriver: true }),
      Animated.timing(ref, { toValue: 1, duration: 160, useNativeDriver: true }),
    ]).start();
  };

  const changePage = (newPage: number) => {
    if (newPage === page) return;
    const dir = newPage > page ? 1 : -1;
    // slide current content out
    Animated.timing(pageAnim, { toValue: -dir * CONTENT_INNER, duration: 220, useNativeDriver: true }).start(() => {
      // update page state
      setPage(newPage);
      // place incoming content offscreen on opposite side
      pageAnim.setValue(dir * CONTENT_INNER);
      // animate incoming content into place
      Animated.timing(pageAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    });
  };

  return (
    <Modal visible={isVisible} transparent animationType="fade" statusBarTranslucent>
      <View style={backdropStyle} />
      <View style={styles.container}>
        <View style={styles.modalCenter}>
          <Pressable style={styles.modalCenter} onPress={onClose} />
          <View style={styles.overlayPress}>
            <View style={containerStyle}>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Ionicons name="close" size={24} color={textColor} />
              </TouchableOpacity>

              <Text style={[styles.title, { color: textColor }]}>
                {t('tabs.more')}
              </Text>

              <View style={[{ width: CONTENT_INNER, overflow: 'hidden', alignSelf: 'center' }]}>
                <Animated.View style={[styles.gridContainer, { transform: [{ translateX: pageAnim }] }] as any}>
                {modules.length === 0 ? (
                  <Text style={[styles.emptyText, { color: textColor }]}>{t('modules.no_more_modules') || 'No more active modules'}</Text>
                ) : (
                  visibleModules.map((mod: any) => (
                    <TouchableOpacity 
                      key={mod.id} 
                      style={[styles.gridItem, { backgroundColor: nodeBackground }]} 
                      onPress={() => handleModulePress(mod)}
                    >
                      <Ionicons name={mod.icon || 'ellipse'} size={22} color={textColor} style={styles.icon} />
                      <Text style={[styles.optionText, { color: textColor }]}> {t(mod.labelKey || mod.id)} </Text>
                    </TouchableOpacity>
                  ))
                )}
                </Animated.View>
              </View>

              {totalPages > 1 && (
                <View style={styles.pagerRow}>
                  {(() => {
                      const leftDisabled = pageSafe <= 0;
                      return (
                        <TouchableOpacity
                          onPress={() => { animateArrow('left'); changePage(Math.max(0, pageSafe - 1)); }}
                          style={[styles.pagerButton, leftDisabled ? styles.pagerButtonDisabled : {}]}
                          disabled={leftDisabled}
                        >
                          <Animated.View style={{ transform: [{ scale: arrowScaleRefs.current.left }] }}>
                            <Text style={[styles.pagerArrow, { color: '#4dccc1' }, leftDisabled ? { opacity: 0.4 } : {}]}>‹</Text>
                          </Animated.View>
                        </TouchableOpacity>
                      );
                    })()}

                  <Text style={[styles.pageIndicator, { color: textColor }]}>{`${pageSafe + 1}/${totalPages}`}</Text>

                  {(() => {
                      const rightDisabled = pageSafe >= totalPages - 1;
                      return (
                        <TouchableOpacity
                          onPress={() => { animateArrow('right'); changePage(Math.min(totalPages - 1, pageSafe + 1)); }}
                          style={[styles.pagerButton, rightDisabled ? styles.pagerButtonDisabled : {}]}
                          disabled={rightDisabled}
                        >
                          <Animated.View style={{ transform: [{ scale: arrowScaleRefs.current.right }] }}>
                            <Text style={[styles.pagerArrow, { color: '#4dccc1' }, rightDisabled ? { opacity: 0.4 } : {}]}>›</Text>
                          </Animated.View>
                        </TouchableOpacity>
                      );
                    })()}
                </View>
              )}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  modalCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  overlayPress: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  modalContainer: {
    width: 360,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    position: 'relative',
    alignSelf: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  gridItem: {
    width: '46%',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4dccc1',
  },
  optionText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    opacity: 0.9,
  },
  icon: {
    marginBottom: 4,
    opacity: 0.9,
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    paddingVertical: 12,
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    top: 16,
    padding: 8,
    borderRadius: 20,
    zIndex: 10,
  }
  ,
  pagerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  pagerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginHorizontal: 8,
  },
  pagerButtonDisabled: {
    opacity: 0.5,
  },
  pagerArrow: {
    fontSize: 22,
    fontWeight: '700',
    width: 34,
    height: 34,
    lineHeight: 31,
    textAlign: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(77,204,193,0.12)',
    overflow: 'hidden',
  },
  pageIndicator: {
    fontSize: 14,
    fontWeight: '600',
  }
});
