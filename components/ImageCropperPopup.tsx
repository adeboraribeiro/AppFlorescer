import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

const SCREEN_WIDTH = Dimensions.get('window').width;
const NODE_SIZE = Math.min(84, Math.floor(SCREEN_WIDTH * 0.22));
const SCREEN_CARD_WIDTH = Math.min(340, SCREEN_WIDTH - 40);

const ImageCropperPopup: React.FC<{ onClose?: () => void; onImageSelected?: (uri: string) => void; aspectRatio?: number }> = ({ onClose, onImageSelected }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const handleImageSelect = async (useCamera: boolean) => {
    try {
      const { status } = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(t('image_cropper.permission_title'), useCamera ? t('image_cropper.permission_camera') : t('image_cropper.permission_gallery'));
        return;
      }

      const result = useCamera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 1 });

  if (!result.canceled && result.assets && result.assets[0]) {
        onImageSelected?.(result.assets[0].uri);
        onClose?.();
      }
    } catch (error) {
      console.error('Error picking image:', error);
  Alert.alert(t('image_cropper.error_title'), t('image_cropper.error_select_failed'));
    }
  };

  return (
    <BlurView intensity={1200} tint="dark" style={StyleSheet.absoluteFill}>
      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.center}>
        <View style={[styles.card, { backgroundColor: isDark ? stylesVars.cardBg : '#F7FFFC', borderColor: stylesVars.accent }]}>
          <TouchableOpacity style={styles.closeButton} onPress={() => onClose?.()}>
            <Ionicons name="close" size={20} color={stylesVars.accent} />
          </TouchableOpacity>

          <Text style={[styles.heading, { color: stylesVars.accent }]}>{t('image_cropper.title')}</Text>

          <View style={styles.row}>
            <TouchableOpacity style={[styles.node, { width: NODE_SIZE, borderColor: stylesVars.accent }]} onPress={() => handleImageSelect(true)}>
              <Ionicons name="camera" size={Math.floor(NODE_SIZE * 0.34)} color={stylesVars.accent} />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.node, { width: NODE_SIZE, borderColor: stylesVars.accent }]} onPress={() => handleImageSelect(false)}>
              <Ionicons name="images" size={Math.floor(NODE_SIZE * 0.34)} color={stylesVars.accent} />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.node, { width: NODE_SIZE, borderColor: stylesVars.accent }]} onPress={() => { onImageSelected?.(''); onClose?.(); }}>
              <Ionicons name="trash" size={Math.floor(NODE_SIZE * 0.3)} color={stylesVars.accent} />
            </TouchableOpacity>
          </View>

          <View style={styles.labelsRow}>
            <Text style={[styles.label, { width: NODE_SIZE, color: stylesVars.accent }]}>{t('image_cropper.camera')}</Text>
            <Text style={[styles.label, { width: NODE_SIZE, color: stylesVars.accent }]}>{t('image_cropper.gallery')}</Text>
            <Text style={[styles.label, { width: NODE_SIZE, color: stylesVars.accent }]}>{t('image_cropper.remove')}</Text>
          </View>
        </View>
        </View>
      </View>
    </BlurView>
  );
};

export const stylesVars = {
  cardBg: '#0A1E1C',
  accent: '#4DCDC1',
};

const styles = StyleSheet.create({
  overlay: {
  ...StyleSheet.absoluteFillObject,
  backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: SCREEN_CARD_WIDTH,
    borderRadius: 12,
  backgroundColor: stylesVars.cardBg,
  borderWidth: 0.7,
    paddingVertical: 18,
    paddingHorizontal: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  heading: {
    fontSize: 18,
    fontWeight: '800',
    color: stylesVars.accent,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    width: '100%',
    paddingHorizontal: 8,
  },
  labelsRow: {
    marginTop: 10,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingHorizontal: 8,
  },
  label: {
    fontSize: 13,
    color: stylesVars.accent,
    textAlign: 'center',
  },
  node: {
    width: 72,
    aspectRatio: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: stylesVars.accent,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    marginHorizontal: 6,
  },
  closeButton: {
    position: 'absolute',
    right: 10,
    top: 10,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: 'transparent',
  },
});

export default ImageCropperPopup;
