import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Animated,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

interface ConfirmDeletionModalProps {
  isVisible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  // `moduleLabel` should be the already-translated display string for the module
  moduleLabel?: string;
}

export default function ConfirmDeletionModal({ isVisible, onClose, onConfirm, moduleLabel }: ConfirmDeletionModalProps) {
  const { t } = useTranslation();
  const moduleDisplay = moduleLabel ?? '';
  // Interpolated title: e.g. "Remove Partnership?"
  const title = t('modules.delete_confirm', { module: moduleDisplay }) || `Remove ${moduleDisplay || 'this module'}?`;
  // Interpolated message explaining consequences
  const message = t('modules.delete_message', { module: moduleDisplay }) || `If you remove ${moduleDisplay || 'this module'}, all data associated with it will be permanently deleted and cannot be recovered.`;

  // Local visibility so we can animate out before unmounting modal
  const [localVisible, setLocalVisible] = useState<boolean>(!!isVisible);
  const anim = useRef(new Animated.Value(isVisible ? 1 : 0)).current;

  useEffect(() => {
    if (isVisible) {
      setLocalVisible(true);
      Animated.spring(anim, { toValue: 1, friction: 8, tension: 80, useNativeDriver: true }).start();
    } else {
      Animated.timing(anim, { toValue: 0, duration: 180, easing: undefined, useNativeDriver: true }).start(() => {
        setLocalVisible(false);
      });
    }
  }, [isVisible, anim]);

  if (!localVisible) return null;

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] });
  const opacity = anim;

  return (
    <Modal
      visible={localVisible}
      transparent
      animationType="none"
      onRequestClose={() => {
        // animate out then notify parent to actually close (prevents parent from clearing props during fade)
        Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
          setLocalVisible(false);
          try { onClose(); } catch (e) { /* ignore */ }
        });
      }}
      statusBarTranslucent
    >
      <BlurView intensity={1500} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="auto">
        <View style={styles.modalOverlay} pointerEvents="box-none">
          {/* blocking layer to absorb touches so background list doesn't receive swipes */}
          <View style={StyleSheet.absoluteFill} pointerEvents="auto" />
          <Animated.View style={[styles.animatedCard, { transform: [{ scale }], opacity }]}> 
            <View style={styles.modalContentInner}>
              <View style={styles.iconContainer}>
                <Ionicons name="trash-outline" size={32} color="#ff4444" />
              </View>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.message}>{message}</Text>
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.button, styles.deleteButton]}
                  onPress={() => {
                    // Animate out locally, then call parent's onConfirm to perform the action
                    Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
                      setLocalVisible(false);
                      try { onConfirm(); } catch (e) { /* ignore */ }
                    });
                  }}
                >
                  <Text style={[styles.buttonText, styles.deleteButtonText]}>{t('common.delete') || 'Delete'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={() => {
                    Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
                      setLocalVisible(false);
                      try { onClose(); } catch (e) { /* ignore */ }
                    });
                  }}
                >
                  <Text style={[styles.buttonText, styles.cancelButtonText]}>{t('common.cancel') || 'Cancel'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </View>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 30, 28, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#0E2E2C',
    borderRadius: 16,
    padding: 0,
    width: '90%',
    maxWidth: 420,
    alignItems: 'center',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  animatedCard: {
    width: '90%',
    maxWidth: 420,
  },
  modalContentInner: {
    backgroundColor: '#0E2E2C',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4DCCC1',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,68,68,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4DCCC1',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: '#4DCCC1',
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
    minWidth: 110,
  },
  cancelButton: {
    backgroundColor: 'rgba(77,204,193,0.06)',
    borderWidth: 1,
    borderColor: '#4DCCC1',
  },
  deleteButton: {
    backgroundColor: 'rgba(255,68,68,0.06)',
    borderWidth: 1,
    borderColor: '#ff4444',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  cancelButtonText: {
    color: '#4DCCC1',
  },
  deleteButtonText: {
    color: '#ff4444',
  },
});
