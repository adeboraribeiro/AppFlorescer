import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { getEntry, updateEntry } from '../../lib/entries';

export default function EditEntryView() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const router = useRouter();
  const params = useLocalSearchParams();
  const entryId = params.id as string;

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [isDateInvalid, setIsDateInvalid] = useState(false);

  // date as string in DD/MM/YYYY
  const formatDate = (d: Date) => {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = String(d.getFullYear());
    return `${dd}/${mm}/${yyyy}`;
  };

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

  const handleSave = () => {
    if (!title.trim()) return; // require title
    if (!isValidDateStr(dateStr)) {
      setIsDateInvalid(true);
      return;
    }
    // convert to ISO using parsed date
    const [d, m, y] = dateStr.split('/').map(Number);
    const iso = new Date(y, m - 1, d).toISOString();
    const payload = { id: entryId, title: title.trim(), body: body.trim() || undefined, date: iso };
    const updated = updateEntry(entryId, { title: payload.title, body: payload.body, date: payload.date });
    if (!updated) {
      // fallback: create if missing
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { createEntry } = require('../../lib/entries');
      createEntry(payload as any);
    }
    router.back();
  };

  useEffect(() => {
    if (entryId) {
      const e = getEntry(entryId);
      if (e) {
        setTitle(e.title);
        setBody(e.body ?? '');
        setDateStr(formatDate(new Date(e.date)));
      } else {
        // not found: populate defaults
        setTitle('');
        setBody('');
        setDateStr(formatDate(new Date()));
      }
    }
  }, [entryId]);

  const placeholderColor = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)';

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0A1E1C' : '#F7FFFC' }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#4DCDC2" />
          <Text style={[styles.backText, { color: '#4DCDC2' }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: '#4DCDC1' }]}>Edit Entry</Text>
        <View style={{ width: 70 }} /> {/* Spacer to center title */}
      </View>

      <View style={styles.content}>
        <TextInput 
          placeholder="Title" 
          placeholderTextColor={placeholderColor}
          value={title}
          onChangeText={setTitle}
          style={[styles.input, { 
            color: isDark ? '#E5E7EB' : '#0A1E1C',
            borderColor: 'rgba(77,204,193,0.22)',
            backgroundColor: isDark ? 'rgba(77,204,193,0.02)' : 'rgba(77,204,193,0.02)',
            fontWeight: '600'
          }]}
        />

        <TextInput 
          placeholder="Description (optional)"
          placeholderTextColor={placeholderColor}
          value={body}
          onChangeText={setBody}
          multiline
          numberOfLines={3}
          style={[styles.textarea, {
            color: isDark ? '#E5E7EB' : '#0A1E1C',
            borderColor: 'rgba(77,204,193,0.12)',
            backgroundColor: isDark ? 'rgba(77,204,193,0.01)' : 'rgba(77,204,193,0.01)',
            fontWeight: '500'
          }]}
        />

        <View style={{ position: 'relative', width: '100%' }}>
          <TextInput
            placeholder="DD/MM/YYYY"
            placeholderTextColor={placeholderColor}
            value={dateStr}
            editable={false}
            maxLength={10}
            style={[styles.input, styles.birthdateInput, {
              color: isDark ? '#E5E7EB' : '#0A1E1C',
              borderColor: isDateInvalid ? '#DC2626' : 'rgba(77,204,193,0.12)',
              backgroundColor: isDark ? 'rgba(77,204,193,0.01)' : 'rgba(77,204,193,0.01)',
              paddingRight: 64,
              textAlign: 'left',
              fontWeight: '600'
            }]}
          />

          <TouchableOpacity
            onPress={() => changeDateBy(1)}
            style={[styles.arrowCircle, { position: 'absolute', right: 8, top: 11, zIndex: 10, backgroundColor: 'rgba(77,204,193,0.5)' }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-up" size={14} color={isDateInvalid ? '#DC2626' : '#4DCDC2'} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => changeDateBy(-1)}
            style={[styles.arrowCircle, { position: 'absolute', right: 46, top: 11, zIndex: 10, backgroundColor: 'rgba(77,204,193,0.5)' }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-down" size={14} color={isDateInvalid ? '#DC2626' : '#4DCDC2'} />
          </TouchableOpacity>
        </View>
        {isDateInvalid && <Text style={styles.errorText}>Invalid date</Text>}

        <View style={styles.actionsRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.button, styles.cancelButton]}
          >
            <Text style={[styles.buttonText, { color: '#4DCDC2' }]}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSave}
            disabled={!title.trim() || isDateInvalid}
            accessibilityState={{ disabled: !title.trim() || isDateInvalid }}
            style={[
              styles.button,
              styles.saveButton,
              {
                borderColor: (!title.trim() || isDateInvalid) ? '#9CCFC8' : '#4DCDC2',
                backgroundColor: (!title.trim() || isDateInvalid) ? 'rgba(77,204,193,0.03)' : 'rgba(77,204,193,0.06)',
                opacity: (!title.trim() || isDateInvalid) ? 0.8 : 1
              }
            ]}
          >
            <Text style={[styles.buttonText, { color: (!title.trim() || isDateInvalid) ? '#9CCFC8' : '#4DCDC2' }]}>
              Save Changes
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingRight: 12,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 16,
    marginBottom: 12,
  },
  textarea: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  birthdateInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 16,
    marginBottom: 16,
  },
  arrowCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    marginTop: -12,
    marginBottom: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 'auto',
    paddingTop: 16,
  },
  button: {
    minWidth: 120,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderColor: '#4DCDC2',
    backgroundColor: 'rgba(77,204,193,0.06)',
  },
  saveButton: {
    borderColor: '#4DCDC2',
    backgroundColor: 'rgba(77,204,193,0.06)',
  },
  buttonText: {
    fontWeight: '700',
  },
});
