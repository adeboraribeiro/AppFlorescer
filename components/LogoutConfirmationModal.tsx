import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

interface LogoutConfirmationModalProps {
  isVisible: boolean;
  onClose: () => void;
  onLogout: () => void;
}

export default function LogoutConfirmationModal({
  isVisible,
  onClose,
  onLogout,
}: LogoutConfirmationModalProps) {
  const { t } = useTranslation();
  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
    <BlurView intensity={1500} tint="dark" style={StyleSheet.absoluteFill}>
      <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.iconContainer}>
              <Ionicons name="log-out-outline" size={32} color="#4DCCC1" />
            </View>
            <Text style={styles.title}>{t('auth_logout.title')}</Text>
            <Text style={styles.message}>{t('auth_logout.message')}</Text>
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.logoutButton]}
                onPress={onLogout}
              >
                <Text style={[styles.buttonText, styles.logoutButtonText]}>{t('auth_logout.confirm')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={onClose}
              >
                <Text style={[styles.buttonText, styles.cancelButtonText]}>{t('auth_logout.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
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
    padding: 24,
    width: '90%',
    maxWidth: 400,
  alignItems: 'center',
  borderWidth: 1,
  borderColor: '#4DCCC1',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
  backgroundColor: 'rgba(77, 204, 193, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  color: '#4DCCC1',
    marginBottom: 8,
  },
  message: {
    fontSize: 16,
  color: '#4DCCC1',
    textAlign: 'center',
    marginBottom: 24,
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
  logoutButton: {
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
  logoutButtonText: {
  color: '#ff4444',
  },
});
