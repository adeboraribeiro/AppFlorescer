import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import entryStore from '../../lib/entries';

export default function EditEntryView() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const isDark = theme === 'dark';
  const router = useRouter();
  const params = useLocalSearchParams();
  const entryId = params.id as string;

  // Get title and number from URL params if available (from EntCreator)
  const initialTitle = typeof params.title === 'string' ? decodeURIComponent(params.title) : '';
  const entryNumber = typeof params.number === 'string' ? parseInt(params.number, 10) : 0;
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState('');

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    
    // Require both title and body
    if (!trimmedTitle || !trimmedBody) return;
    
    const baseWord = t('entry.new').toLowerCase().startsWith('new') ? 'Entry' : 'Registro';
    const payload = { 
      title: entryNumber > 0 ? `${baseWord} ${entryNumber}` : trimmedTitle, 
      body: trimmedBody,
      // Use the date from params if available, otherwise use current date
      date: params.date ? decodeURIComponent(params.date as string) : new Date().toISOString()
    };

    try {
      const updated = entryId ? await entryStore.updateEntry(entryId, payload) : null;
      if (!updated) {
        await entryStore.createEntry(payload);
      }
      router.back();
    } catch (e) {
      console.warn('Failed to save entry:', e);
    }
  };

  useEffect(() => {
    if (entryId) {
      const loadEntry = async () => {
        const e = await entryStore.getEntry(entryId);
        if (e) {
          // Only set title from storage if we don't have an initial title from params
          if (!initialTitle) {
            setTitle(e.title);
          }
          setBody(e.body || '');
        }
      };
      loadEntry();
    }
  }, [entryId, initialTitle]);

  const placeholderColor = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: isDark ? '#0A1E1C' : '#FFFFFF' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconTouch}>
          <Ionicons name="chevron-back" size={24} color="#4dccc1" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
                <Text style={styles.headerTitle}>{t('entry.edit')}</Text>
        </View>
  <TouchableOpacity 
          onPress={handleSave} 
          disabled={!title.trim() || !body.trim()} 
          style={styles.saveTouch}>
          <View style={[
            styles.saveButton,
            {
              backgroundColor: !title.trim() || !body.trim()
                ? (isDark ? 'rgba(77,204,193,0.08)' : 'rgba(77,204,193,0.08)')
                : (isDark ? 'rgba(77,204,193,0.15)' : 'rgba(77,204,193,0.15)'),
              borderColor: !title.trim() || !body.trim() ? '#9CCFC8' : '#4dccc1',
              opacity: !title.trim() || !body.trim() ? 0.6 : 1
            }
          ]}>
            <Text style={[styles.saveText, { 
              color: !title.trim() || !body.trim() ? '#9CCFC8' : '#4dccc1',
            }]}>
              {t('entry.save')}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
      {/* Content */}
      <ScrollView 
        style={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Title Section */}
        <View style={styles.section}>
          <View style={styles.labelRow}>
            <Ionicons name="create-outline" size={16} color="#4dccc1" style={styles.labelIcon} />
            <Text style={styles.label}>{t('entry.title')}</Text>
          </View>
          <View style={styles.inputContainer}>
            <TextInput 
              placeholder={t('entry.enter_title')} 
              placeholderTextColor={placeholderColor}
              value={title}
              onChangeText={setTitle}
              style={[styles.titleInput, { 
                color: isDark ? '#E5E7EB' : '#0A1E1C',
                borderColor: 'rgba(77,204,193,0.7)',
                backgroundColor: isDark ? 'rgba(77,204,193,0.05)' : 'rgba(77,204,193,0.05)',
              }]}
            />
          </View>
        </View>

        {/* Body Section */}
        <View style={[styles.section, styles.bodySection]}>
          <View style={styles.labelRow}>
            <Ionicons name="document-text-outline" size={16} color="#4dccc1" style={styles.labelIcon} />
            <Text style={styles.label}>{t('entry.content')}</Text>
          </View>
          <View style={styles.inputContainer}>
            <TextInput 
              placeholder={t('entry.start_writing')} 
              placeholderTextColor={placeholderColor}
              value={body}
              onChangeText={setBody}
              multiline
              textAlignVertical="top"
              style={[styles.bodyInput, { 
                color: isDark ? '#E5E7EB' : '#0A1E1C',
                borderColor: 'rgba(77,204,193,0.7)',
                backgroundColor: isDark ? 'rgba(77,204,193,0.05)' : 'rgba(77,204,193,0.05)',
              }]}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
  flex: 1,
  paddingTop: 0,
  },
  header: {
  width: '100%',
  flexDirection: 'row',
  alignItems: 'center',
  paddingTop: 20,
  paddingHorizontal: 20,
  marginBottom: 0,
  },
  iconTouch: {
  padding: 6,
  width: 44,
  alignItems: 'center',
  },
  saveTouch: {
  paddingHorizontal: 8,
  paddingVertical: 8,
  alignItems: 'center',
  justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 35,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4dccc1',
    letterSpacing: 0.3,
  },
  saveButton: {
  paddingHorizontal: 14,
  paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  saveText: {
  fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 24,
  },
  bodySection: {
    flex: 1,
    marginBottom: 40,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingLeft: 4,
  },
  labelIcon: {
    marginRight: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4dccc1',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    opacity: 0.8,
  },
  inputContainer: {
    position: 'relative',
  },
  titleInput: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 18,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  bodyInput: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 18,
    fontSize: 16,
    fontWeight: '400',
    minHeight: 450,
    lineHeight: 26,
    letterSpacing: 0.1,
  },
});