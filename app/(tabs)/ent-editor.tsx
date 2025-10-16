import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, DeviceEventEmitter, KeyboardAvoidingView, Modal, Platform, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { useSafeUserData } from '../../components/SafeUserDataProvider';
import { useTheme } from '../../contexts/ThemeContext';

export default function EditEntryView() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const isDark = theme === 'dark';
  const router = useRouter();
  const params = useLocalSearchParams();
  const entryId = params.id as string | undefined;
  const [currentId, setCurrentId] = useState<string | undefined>(entryId);
  // Get title and number from URL params if available (from EntCreator)
  const initialTitle = typeof params.title === 'string' ? decodeURIComponent(params.title) : '';
  const entryNumber = typeof params.number === 'string' ? parseInt(params.number, 10) : 0;
  // Read cached journal entry synchronously to avoid flicker on editor open
  const { getCachedCategory, sendCreateJournalEntry, sendUpdateJournalEntry, fetchRawFlo, setPasskey, readCategory, writeCategory, clearPasskey, deleteUserFlo, listJournalEntries } = useSafeUserData();
  const cachedJournal = getCachedCategory('journal');
  const cachedEntry = entryId ? (cachedJournal && typeof cachedJournal === 'object' ? (cachedJournal as any)[entryId] : undefined) : undefined;
  const [title, setTitle] = useState<string>(cachedEntry?.title ?? initialTitle);
  const [body, setBody] = useState<string>(cachedEntry?.body ?? '');
  // local id for new entries so editor never needs to read from storage
  const [generatedId, setGeneratedId] = useState<string | undefined>(undefined);
 
  const [showEncModal, setShowEncModal] = useState(false);
  const [encRaw, setEncRaw] = useState<string | null>(null);
  const [encIsEncrypted, setEncIsEncrypted] = useState<boolean>(false);
  const [encBase64Decoded, setEncBase64Decoded] = useState<string | undefined>(undefined);
  const [encPath, setEncPath] = useState<string | null>(null);
  const [encInfo, setEncInfo] = useState<any>(null);
  const [passkeyInput, setPasskeyInput] = useState('');
  const [encrypting, setEncrypting] = useState(false);
  const [decrypting, setDecrypting] = useState(false);
  const [encDecrypted, setEncDecrypted] = useState<string | undefined>(undefined);
  const [wrapLines, setWrapLines] = useState(true);
  const [prettyJson, setPrettyJson] = useState(true);
  const [encStatusMsg, setEncStatusMsg] = useState<string | null>(null);
  const [viewerLoaded, setViewerLoaded] = useState(false);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerText, setViewerText] = useState<string | null>(null);
  const [viewerSize, setViewerSize] = useState<number>(0);

  // Loading overlay state (used for opening an entry or when saving)
  const [showOverlay, setShowOverlay] = useState(false);
  const [overlayText, setOverlayText] = useState<string | undefined>(undefined);
  const overlayTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track the last saved snapshot to avoid redundant autosaves
  const lastSavedRef = React.useRef<{ title: string; body: string }>({ title: (cachedEntry?.title ?? initialTitle).trim(), body: (cachedEntry?.body ?? '').trim() });

  const startOverlayWithDelay = (text?: string, delay = 150) => {
    // don't stack timers
    if (overlayTimer.current) return;
    overlayTimer.current = setTimeout(() => {
      setOverlayText(text);
      setShowOverlay(true);
      overlayTimer.current = null;
    }, delay);
  };

  const stopOverlay = () => {
    try {
      if (overlayTimer.current) {
        clearTimeout(overlayTimer.current as any);
        overlayTimer.current = null;
      }
    } catch (e) { /* ignore */ }
    setShowOverlay(false);
    setOverlayText(undefined);
  };

  const openEncryptionView = async () => {
    try {
      const res = await fetchRawFlo();
      setEncRaw(res.raw);
      setEncIsEncrypted(res.isEncrypted);
      setEncBase64Decoded((res as any).base64Decoded);
      setEncPath(res.path || null);
      setEncInfo(res.info || null);
  // prepare viewer state but don't compute heavy formatting yet
  const rawPreview = (res as any).base64Decoded ?? res.raw ?? '';
  const size = rawPreview ? rawPreview.length : 0;
  setViewerSize(size);
  setViewerLoaded(false);
  setViewerText(null);
  setViewerLoading(false);
  setShowEncModal(true);
    } catch (e) {
      console.warn('fetchRawFlo failed', e);
    }
  };

  const encryptFileNow = async () => {
    // Only operate when file exists and is not already encrypted
    if (!encRaw || encIsEncrypted) return;
    if (!passkeyInput || passkeyInput.trim().length < 4) {
      Alert.alert(t('journal.passkey_invalid_title', 'Invalid passkey'), t('journal.passkey_invalid', 'Passkey must be at least 4 characters long'));
      return;
    }
    setEncrypting(true);
    setEncStatusMsg(null);
    try {
      // store passkey in secure store
      await setPasskey(passkeyInput.trim());
      // read current journal payload (plaintext) and re-write it encrypted
      const payload = await readCategory('journal');
      if (!payload) {
        // nothing to encrypt — warn user
        setEncStatusMsg(t('journal.nothing_to_encrypt', 'No journal data found to encrypt'));
      }
      // writeCategory will encrypt using provided passkey param (or stored one)
      await writeCategory('journal', payload, passkeyInput.trim());
      // refresh modal state
      const refreshed = await fetchRawFlo(passkeyInput.trim());
      setEncRaw(refreshed.raw);
      setEncIsEncrypted(refreshed.isEncrypted);
      setEncBase64Decoded((refreshed as any).base64Decoded);
      setEncPath(refreshed.path || null);
      setEncInfo(refreshed.info || null);
      setEncStatusMsg(t('journal.encrypted_success', 'Journal encrypted successfully'));
    } catch (e) {
      const msg = (e && (e as any).message) ? (e as any).message : String(e);
      setEncStatusMsg(msg);
      Alert.alert(t('journal.encrypt_failed', 'Encryption failed'), msg);
      console.warn('encryptFileNow failed', e);
    } finally {
      setEncrypting(false);
    }
  };

  const decryptFileNow = async () => {
    if (!encRaw || !encIsEncrypted) return;
    if (!passkeyInput || passkeyInput.trim().length < 1) {
      Alert.alert(t('journal.passkey_invalid_title', 'Invalid passkey'), t('journal.passkey_required', 'Please enter a passkey'));
      return;
    }
    setDecrypting(true);
    setEncStatusMsg(null);
    try {
      const cleaned = passkeyInput.trim();
      const res = await fetchRawFlo(cleaned);
      setEncRaw(res.raw);
      setEncIsEncrypted(res.isEncrypted);
      setEncBase64Decoded((res as any).base64Decoded);
      setEncPath(res.path || null);
      setEncInfo(res.info || null);
      if (res.decrypted) {
        setEncDecrypted(res.decrypted);
        setEncStatusMsg(t('journal.decrypted_success', 'Decrypted successfully'));
        // remember passkey for convenience (user asked passkey be saved until logout)
        try { await setPasskey(cleaned); } catch (e) { /* ignore */ }
      } else {
        setEncDecrypted(undefined);
        setEncStatusMsg(t('journal.decrypt_failed', 'Failed to decrypt with provided passkey'));
        Alert.alert(t('journal.decrypt_failed', 'Failed to decrypt with provided passkey'));
      }
    } catch (e) {
      const msg = (e && (e as any).message) ? (e as any).message : String(e);
      setEncStatusMsg(msg);
      Alert.alert(t('journal.decrypt_failed', 'Failed to decrypt'), msg);
    } finally {
      setDecrypting(false);
    }
  };

  // helpers for viewer
  const tryPrettyJson = (s: string) => {
    try {
      const parsed = JSON.parse(s);
      return JSON.stringify(parsed, null, 2);
    } catch (e) {
      return null;
    }
  };

  const breakLongWords = (s: string, limit = 200) => {
    // insert zero-width space every `limit` chars within long non-whitespace runs
    return s.replace(/(\S{200})/g, '$1\u200B');
  };

  // Lazy compute viewer text to avoid blocking UI on very large files
  const computeViewerText = (source: string) => {
    // run heavy transforms on next tick to let UI update
    return new Promise<string>((resolve) => {
      setTimeout(() => {
        let raw = source;
        if (prettyJson) {
          const p = tryPrettyJson(raw);
          if (p) raw = p;
        }
        if (wrapLines) raw = breakLongWords(raw, 200);
        resolve(raw);
      }, 50);
    });
  };

  const loadViewer = async (full: boolean = false) => {
    if (viewerLoaded || viewerLoading) return;
    const src = encDecrypted ?? encBase64Decoded ?? encRaw ?? '';
    if (!src) {
      setViewerText('(no file)');
      setViewerLoaded(true);
      return;
    }
    // If not full and very large, try to limit to a preview slice
    const threshold = 150 * 1024; // 150 KB
    let sourceToUse = src;
    if (!full && (src.length > threshold)) {
      sourceToUse = src.slice(0, Math.min(src.length, 64 * 1024)); // 64KB preview
    }
    setViewerLoading(true);
    try {
      const result = await computeViewerText(sourceToUse);
      setViewerText(result);
      setViewerLoaded(true);
    } catch (e) {
      setViewerText('(failed to render preview)');
      setViewerLoaded(true);
    } finally {
      setViewerLoading(false);
    }
  };

  const copyRaw = async () => {
    const text = encRaw ?? encBase64Decoded ?? '';
    if (!text) {
      Alert.alert(t('journal.nothing_to_copy', 'Nothing to copy'));
      return;
    }
    try {
      await Share.share({ message: text });
    } catch (e) {
      const msg = (e && (e as any).message) ? (e as any).message : String(e);
      Alert.alert(t('journal.copy_failed', 'Copy failed'), msg);
    }
  };

  const clearEncryption = () => {
    // confirm destructive action
    Alert.alert(
      t('journal.clear_encryption_confirm_title', 'Delete encrypted data?'),
      t('journal.clear_encryption_confirm', 'This will delete your local journal file and clear the stored passkey. This cannot be undone.'),
      [
        { text: t('cancel', 'Cancel'), style: 'cancel' },
        { text: t('delete', 'Delete'), style: 'destructive', onPress: async () => {
          try {
            // remove file then clear passkey
            await deleteUserFlo();
            try { await clearPasskey(); } catch (e) { /* ignore */ }
            // reset modal state
            setEncRaw(null);
            setEncIsEncrypted(false);
            setEncDecrypted(undefined);
            setEncBase64Decoded(undefined);
            setEncPath(null);
            setEncInfo(null);
            setEncStatusMsg(t('journal.cleared', 'Cleared encrypted file and passkey'));
            try { DeviceEventEmitter.emit('refreshEntries'); } catch (e) { /* ignore */ }
            try { DeviceEventEmitter.emit('floDeleted'); } catch (e) { /* ignore */ }
            // close modal and return to previous screen to avoid autosave recreating file
            setShowEncModal(false);
            try { router.back(); } catch (e) { /* ignore */ }
          } catch (e) {
            const msg = (e && (e as any).message) ? (e as any).message : String(e);
            Alert.alert(t('journal.clear_failed', 'Failed to clear'), msg);
          }
        } }
      ]
    );
  };

  // saveEntry: saves and optionally navigates back. Used by autosave (navigateBack=false)
  const handleSave = async (navigateBack: boolean = true) => {
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();

    // Require both title and body
    if (!trimmedTitle || !trimmedBody) return;

    // If the user provided a custom title, use it. Otherwise, fall back to Entry <number> from params or computed entryNumber.
    const baseWord = t('entry.new').toLowerCase().startsWith('new') ? 'Entry' : 'Registro';
    let finalTitle = trimmedTitle;
    if (!finalTitle) {
      if (entryNumber > 0) finalTitle = `${baseWord} ${entryNumber}`;
      else finalTitle = `${baseWord}`;
    }

    const payload = {
      title: finalTitle,
      body: trimmedBody,
      // Use the date from params if available, otherwise use current date
      date: params.date ? decodeURIComponent(params.date as string) : new Date().toISOString()
    };

    try {
      // For user-initiated save + navigateBack, await provider so we can show overlay
      if (navigateBack) startOverlayWithDelay(t('entry.saving', 'Saving...'));

      if (currentId) {
        // update existing entry
        if (navigateBack) {
          await sendUpdateJournalEntry(currentId, payload);
        } else {
          // autosave: fire-and-forget
          sendUpdateJournalEntry(currentId, payload).catch((err) => console.warn('update failed', err));
        }
      } else {
        // create with a client-generated id so subsequent autosaves/updates can reference it
        const clientId = generatedId ?? `${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
        setGeneratedId(clientId);
        setCurrentId(clientId);
        if (navigateBack) {
          await sendCreateJournalEntry({ ...payload, id: clientId });
        } else {
          // autosave: fire-and-forget
          sendCreateJournalEntry({ ...payload, id: clientId }).catch((err) => console.warn('create failed', err));
        }
      }

      try { DeviceEventEmitter.emit('refreshEntries'); } catch (e) { /* ignore */ }

      if (navigateBack) {
        stopOverlay();
        router.back();
      }
    } catch (e) {
      console.warn('Failed to send entry:', e);
    }
  // update lastSaved snapshot to current content (optimistic)
  try { lastSavedRef.current = { title: title.trim(), body: body.trim() }; } catch (e) {}
  };

  // Autosave: save 2s after last change to title/body
  const autosaveTimer = React.useRef<any>(null);
  useEffect(() => {
    // don't autosave empty drafts
    const ttrim = title.trim();
    const btrim = body.trim();
    // If nothing changed since last saved, skip scheduling autosave
    if (ttrim === lastSavedRef.current.title && btrim === lastSavedRef.current.body) return;
    if (!ttrim && !btrim) return;
    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
    }
    autosaveTimer.current = setTimeout(() => {
      // run autosave slightly deferred to allow UI to update before heavy crypto work
      setTimeout(() => { handleSave(false); }, 50);
      autosaveTimer.current = null;
    }, 5000);
    return () => {
      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current);
        autosaveTimer.current = null;
      }
    };
  }, [title, body]);

  // IMPORTANT: Editor is locked from reading storage/provider. It must not fetch existing entry content.
  // If `entryId` is provided via params, we accept it only for later updates but do NOT load data from storage.
  useEffect(() => {
    let mounted = true;
    // If an entry id was provided, load that single entry once to populate the editor fields.
    // This keeps the editor send-only for saves but allows users to edit an existing entry's content.
    if (entryId) {
      // Try to load from in-memory cache synchronously to avoid flicker
      try {
        const cached = getCachedCategory('journal');
        const foundCached = cached && typeof cached === 'object' ? (cached as any)[entryId] : undefined;
        if (foundCached) {
          if (mounted) {
            setTitle(foundCached.title ?? '');
            setBody(foundCached.body ?? '');
            setCurrentId(entryId);
          }
        }
      } catch (e) { /* ignore cache errors */ }
  (async () => {
        try {
          // If cache miss, load may require decryption — show overlay only if work takes longer than delay
          let usedCache = false;
          try {
            const cached = getCachedCategory('journal');
            const foundCached = cached && typeof cached === 'object' ? (cached as any)[entryId] : undefined;
            if (foundCached) {
              usedCache = true;
            }
          } catch (e) { /* ignore */ }

          if (!usedCache) startOverlayWithDelay(t('entry.loading_entry', 'Loading entry...'));

          // Try to read the full journal category (will decrypt when needed)
          try {
            const full = await readCategory('journal');
            const foundFull = full && typeof full === 'object' ? (full as any)[entryId] : undefined;
            if (mounted && foundFull) {
              setTitle(foundFull.title ?? '');
                setBody(foundFull.body ?? '');
                // mark loaded content as saved to avoid immediate autosave
                try { lastSavedRef.current = { title: (foundFull.title ?? '').trim(), body: (foundFull.body ?? '').trim() }; } catch (e) {}
              setCurrentId(entryId);
              stopOverlay();
              return;
            }
          } catch (innerErr) {
            // Continue to fallback to list previews below
          }

          const list = await listJournalEntries();
          const found = Array.isArray(list) ? list.find(e => e.id === entryId) : undefined;
          if (mounted && found) {
            setTitle(found.title ?? '');
            setBody(found.body ?? '');
            try { lastSavedRef.current = { title: (found.title ?? '').trim(), body: (found.body ?? '').trim() }; } catch (e) {}
            setCurrentId(entryId);
          } else if (mounted) {
            // If not found, still set current id so subsequent saves update the correct id
            setCurrentId(entryId);
          }
          stopOverlay();
        } catch (e) {
          // ignore errors and still set currentId so updates will use this id
          if (mounted) setCurrentId(entryId);
          stopOverlay();
        }
  })();
    }
    return () => { mounted = false; };
  }, [entryId, listJournalEntries]);

  const placeholderColor = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: isDark ? '#0A1E1C' : '#FFFFFF' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {showOverlay && (
        <LoadingOverlay loadingText={overlayText} isDark={isDark} opacity={1} />
      )}
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconTouch}>
          <Ionicons name="chevron-back" size={24} color="#4dccc1" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
                <Text style={styles.headerTitle}>{t('entry.edit')}</Text>
        </View>
      <TouchableOpacity onPress={openEncryptionView} style={[styles.iconTouch, { marginRight: 8 }]}> 
              <Text style={{ color: '#4dccc1', fontWeight: '700' }}>{t('entry.view_encryption', 'View Encryption')}</Text>
            </TouchableOpacity>
      <TouchableOpacity 
              onPress={() => { handleSave(true); }} 
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
              onChangeText={(text) => setTitle(text.slice(0, 64))}
              maxLength={64}
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
      <Modal visible={showEncModal} transparent animationType="fade" onRequestClose={() => setShowEncModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <View style={{ width: '100%', maxHeight: '80%', backgroundColor: isDark ? '#07110f' : '#fff', padding: 12, borderRadius: 10 }}>
            <Text style={{ fontWeight: '700', color: '#4dccc1', marginBottom: 8 }}>{t('entry.encryption_modal_title', 'Encryption')}</Text>
            <Text style={{ color: isDark ? '#dfeffb' : '#05332f', marginBottom: 6 }}><Text style={{ fontWeight: '700' }}>{t('journal.raw_modal_encrypted', 'Encrypted:')}</Text> {encIsEncrypted ? 'Yes' : 'No'}</Text>

            {/* Scrollable viewer: vertical scroll with an inner horizontal scroll for long lines */}
            <View style={{ height: 320, borderRadius: 8, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.06)', backgroundColor: isDark ? '#04100f' : '#fafafa' }}>
              <ScrollView style={{ flex: 1, padding: 8 }} contentContainerStyle={{ flexGrow: 1 }}>
                <ScrollView horizontal contentContainerStyle={{ flexGrow: 1 }}>
                  <Text selectable style={{ color: isDark ? '#dfeffb' : '#05332f', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 13 }}>
                    {encBase64Decoded ?? encRaw ?? '(no file)'}
                  </Text>
                </ScrollView>
              </ScrollView>
            </View>

            {encPath && <Text style={{ marginTop: 8, color: isDark ? '#dfeffb' : '#05332f' }}>{t('journal.raw_modal_path', 'Path:')} {encPath}</Text>}

            {/* If file is not encrypted offer to set a passkey and encrypt */}
            {!encIsEncrypted && (
              <View style={{ marginTop: 12 }}>
                <Text style={{ color: isDark ? '#dfeffb' : '#05332f', marginBottom: 6 }}>{t('journal.set_passkey_prompt', 'Set a passkey to encrypt your journal (saved to secure storage until logout).')}</Text>
                <TextInput placeholder={t('journal.enter_passkey', 'Enter passkey')} placeholderTextColor={placeholderColor} value={passkeyInput} onChangeText={setPasskeyInput} secureTextEntry style={{ borderWidth: 1, borderColor: 'rgba(77,204,193,0.12)', borderRadius: 10, padding: 8, color: isDark ? '#E5E7EB' : '#0A1E1C' }} />
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
                  <TouchableOpacity style={[styles.cardButton, { opacity: encrypting ? 0.6 : 1, marginRight: 8 }]} onPress={encryptFileNow} disabled={encrypting}>
                    <Text style={{ color: '#4dccc1', fontWeight: '700' }}>{encrypting ? t('journal.encrypting', 'Encrypting...') : t('journal.encrypt_now', 'Encrypt')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.cardButton]} onPress={copyRaw}>
                    <Text style={{ color: '#4dccc1', fontWeight: '700' }}>{t('journal.copy_raw', 'Copy raw')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {encIsEncrypted && (
              <View style={{ marginTop: 12 }}>
                <Text style={{ color: isDark ? '#dfeffb' : '#05332f', marginBottom: 6 }}>{t('journal.enter_passkey_prompt', 'Enter passkey to decrypt')}</Text>
                <TextInput placeholder={t('journal.enter_passkey', 'Enter passkey')} placeholderTextColor={placeholderColor} value={passkeyInput} onChangeText={setPasskeyInput} secureTextEntry style={{ borderWidth: 1, borderColor: 'rgba(77,204,193,0.12)', borderRadius: 10, padding: 8, color: isDark ? '#E5E7EB' : '#0A1E1C' }} />
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
                  <TouchableOpacity style={[styles.cardButton, { opacity: decrypting ? 0.6 : 1, marginRight: 8 }]} onPress={decryptFileNow} disabled={decrypting}>
                    <Text style={{ color: '#4dccc1', fontWeight: '700' }}>{decrypting ? t('journal.decrypting', 'Decrypting...') : t('journal.decrypt_now', 'Decrypt')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.cardButton, { opacity: encrypting ? 0.6 : 1, marginRight: 8 }]} onPress={encryptFileNow} disabled={encrypting}>
                    <Text style={{ color: '#4dccc1', fontWeight: '700' }}>{encrypting ? t('journal.encrypting', 'Encrypting...') : t('journal.reencrypt', 'Re-encrypt')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.cardButton]} onPress={copyRaw}>
                    <Text style={{ color: '#4dccc1', fontWeight: '700' }}>{t('journal.copy_raw', 'Copy raw')}</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ marginTop: 8, flexDirection: 'row', justifyContent: 'flex-end' }}>
                  <TouchableOpacity style={[styles.cardButton]} onPress={clearEncryption}>
                    <Text style={{ color: '#ff5c5c', fontWeight: '700' }}>{t('journal.clear_encryption', 'Delete file & clear passkey')}</Text>
                  </TouchableOpacity>
                </View>

                {encDecrypted && (
                  <View style={{ marginTop: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontWeight: '700', color: '#4dccc1', marginBottom: 6 }}>{t('journal.decrypted_preview', 'Decrypted preview')}</Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity onPress={() => setPrettyJson(!prettyJson)} style={[styles.cardButton, { marginRight: 8 }]}>
                          <Text style={{ color: '#4dccc1', fontWeight: '700' }}>{prettyJson ? t('journal.pretty_on', 'Pretty') : t('journal.pretty_off', 'Raw')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setWrapLines(!wrapLines)} style={[styles.cardButton]}>
                          <Text style={{ color: '#4dccc1', fontWeight: '700' }}>{wrapLines ? t('journal.wrap_on', 'Wrap') : t('journal.wrap_off', 'No Wrap')}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <View style={{ marginTop: 8 }}>
                      {!viewerLoaded && (
                        <View style={{ padding: 8 }}>
                          <Text style={{ color: isDark ? '#dfeffb' : '#05332f', marginBottom: 8 }}>{t('journal.preview_limited', 'Preview is limited for large files to avoid crashes.')}</Text>
                          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                            <TouchableOpacity style={[styles.cardButton, { marginRight: 8 }]} onPress={() => loadViewer(false)}>
                              <Text style={{ color: '#4dccc1', fontWeight: '700' }}>{viewerLoading ? t('journal.loading', 'Loading...') : t('journal.load_preview', 'Load preview')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.cardButton, { marginRight: 8 }]} onPress={() => loadViewer(true)}>
                              <Text style={{ color: '#4dccc1', fontWeight: '700' }}>{t('journal.load_full', 'Load full')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.cardButton]} onPress={copyRaw}>
                              <Text style={{ color: '#4dccc1', fontWeight: '700' }}>{t('journal.copy_raw', 'Copy raw')}</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                      {viewerLoaded && (
                        <ScrollView style={{ maxHeight: 260, borderRadius: 8, backgroundColor: isDark ? '#04100f' : '#fafafa', padding: 8 }}>
                          <Text selectable style={{ color: isDark ? '#dfeffb' : '#05332f', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 13, includeFontPadding: false }}>{viewerText}</Text>
                        </ScrollView>
                      )}
                    </View>
                  </View>
                )}
              </View>
            )}

            <View style={{ marginTop: 12, flexDirection: 'row', justifyContent: 'flex-end' }}>
              <TouchableOpacity style={[styles.cardButton]} onPress={() => setShowEncModal(false)}>
                <Text style={{ color: '#4dccc1', fontWeight: '700' }}>{t('close', 'Close')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  cardButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
});