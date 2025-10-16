import CryptoJS from 'crypto-js';
import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

// Minimal Entry type inlined to avoid module resolution issues during incremental edits.
export type Entry = {
  id: string;
  title: string;
  body: string;
  date: string;
  createdAt: string;
  updatedAt: string;
};

// Provider that handles encrypted per-user .flo data stored in SecureStore.
// It decrypts the blob when performing an operation, updates it, then re-encrypts and writes it back.

type JournalMap = { [id: string]: Entry };

type FloData = {
  // user id MUST NOT be stored in plaintext in the persisted file; keep optional
  user?: string;
  journal?: JournalMap;
  // additional categories may be added
};

type SafeUserDataContextValue = {
  userId?: string;
  setUser: (userId?: string) => void;
  // Generic category read/write (decrypts, returns JS object)
  readCategory: (category: string, passkey?: string) => Promise<any>;
  writeCategory: (category: string, payload: any, passkey?: string) => Promise<void>;
  // Fetch the raw .flo file contents (unencrypted string as stored). If the file is encrypted
  // and a passkey is provided, the decrypted plaintext will be returned in `decrypted`.
  fetchRawFlo: (passkey?: string) => Promise<{ raw: string | null; isEncrypted: boolean; decrypted?: string; path: string; base64Decoded?: string; info?: { exists: boolean; size?: number; modificationTime?: number; readError?: string } }>;
  // Journal helpers (SEND-ONLY for editor) — these methods persist data but do NOT return the stored content.
  listJournalEntries: (passkey?: string) => Promise<Entry[]>;
  listFloFiles: () => Promise<string[]>;
  sendCreateJournalEntry: (input: Omit<Entry, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }, passkey?: string) => Promise<void>;
  sendUpdateJournalEntry: (id: string, patch: Partial<Entry>, passkey?: string) => Promise<void>;
  sendDeleteJournalEntry: (id: string, passkey?: string) => Promise<void>;
  // Passkey management stored in SecureStore. Passkey is stored per-user until cleared.
  setPasskey: (passkey: string) => Promise<void>;
  getPasskey: () => Promise<string | null>;
  getPasskeyExists: () => Promise<boolean>;
  // Activate an in-memory session passkey (kept only while app is foregrounded)
  activateSessionPasskey: (passkey: string) => void;
  clearSessionPasskey: () => void;
  // Read cached category value synchronously (may be undefined/null)
  getCachedCategory: (category: string) => any | null;
  clearPasskey: () => Promise<void>;
  // Delete the user's .flo file from disk
  deleteUserFlo: () => Promise<void>;
};

const SafeUserDataContext = createContext<SafeUserDataContextValue | undefined>(undefined);

export const useSafeUserData = (): SafeUserDataContextValue => {
  const ctx = useContext(SafeUserDataContext);
  if (!ctx) throw new Error('useSafeUserData must be used within SafeUserDataProvider');
  return ctx;
};

const PREFIX = 'BROM_'; // encrypted prefix

function derivePassphrase(secret: string) {
  // Derive a consistent passphrase using SHA256 over the provided secret
  return CryptoJS.SHA256(secret).toString();
}

function encryptString(plain: string, userId: string, passkey: string): string {
  // Combine the user-provided passkey with the user id so the effective secret
  // used for key derivation is passkey + userId (e.g. bananasplit455).
  const combined = `${passkey}${userId}`;
  const keyHex = derivePassphrase(combined);
  const ivHex = CryptoJS.SHA256(combined + 'iv').toString().slice(0, 32); // 16 bytes

  const key = CryptoJS.enc.Hex.parse(keyHex);
  const iv = CryptoJS.enc.Hex.parse(ivHex);

  const encrypted = CryptoJS.AES.encrypt(plain, key, { iv }).toString();
  return PREFIX + encrypted;
}

function decryptString(cipherWithPrefix: string, userId: string, passkey: string): string {
  if (!cipherWithPrefix.startsWith(PREFIX)) return cipherWithPrefix;
  const cipher = cipherWithPrefix.substring(PREFIX.length);
  // Combine passkey with userId to form the effective secret (passkey+userId)
  const combined = `${passkey}${userId}`;
  const keyHex = derivePassphrase(combined);
  const ivHex = CryptoJS.SHA256(combined + 'iv').toString().slice(0, 32);

  const key = CryptoJS.enc.Hex.parse(keyHex);
  const iv = CryptoJS.enc.Hex.parse(ivHex);

  // Convert CryptoJS WordArray to Uint8Array
  const wordArrayToUint8 = (wa: CryptoJS.lib.WordArray): Uint8Array => {
    const words = wa.words;
    const sigBytes = wa.sigBytes;
    const u8 = new Uint8Array(sigBytes);
    let offset = 0;
    for (let i = 0; i < words.length; i++) {
      let word = words[i];
      for (let j = 3; j >= 0 && offset < sigBytes; j--) {
        u8[offset++] = (word >>> (8 * j)) & 0xff;
      }
    }
    return u8;
  };

  // Decode Uint8Array to string using TextDecoder if available, with iso-8859-1 fallback.
  const printableScore = (s: string) => {
    if (!s) return 0;
    // score proportion of characters that are printable and common
    let printable = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if ((c >= 32 && c <= 126) || c === 10 || c === 13 || c === 9) printable++;
    }
    return printable / s.length;
  };

  const uint8ToStringSafe = (u8: Uint8Array) => {
    const attempts: string[] = [];
    if (typeof TextDecoder !== 'undefined') {
      try { attempts.push(new TextDecoder('utf-8').decode(u8)); } catch (e) { /* ignore */ }
      try { attempts.push(new TextDecoder('windows-1252').decode(u8)); } catch (e) { /* ignore */ }
      try { attempts.push(new TextDecoder('iso-8859-1').decode(u8)); } catch (e) { /* ignore */ }
    }

    // JS fallback: Latin1 direct
    try {
      let latin1 = '';
      const chunkSize = 0x8000;
      for (let i = 0; i < u8.length; i += chunkSize) {
        const chunk = u8.subarray(i, i + chunkSize);
        latin1 += String.fromCharCode.apply(null, Array.from(chunk));
      }
      attempts.push(latin1);
      try { attempts.push(decodeURIComponent(escape(latin1))); } catch (e) { /* ignore */ }
    } catch (e) { /* ignore */ }

    // pick the attempt with the highest printable score
    let best = '';
    let bestScore = -1;
    for (const a of attempts) {
      const sc = printableScore(a);
      if (sc > bestScore) { bestScore = sc; best = a; }
    }
    return best || '';
  };

  try {
    const bytes = CryptoJS.AES.decrypt(cipher, key, { iv });
    const u8 = wordArrayToUint8(bytes);
    const result = uint8ToStringSafe(u8);
    if (!result) throw new Error('Failed to decrypt content');
    return result;
  } catch (e) {
    throw new Error('Failed to decrypt content');
  }
}

async function fileGet(path: string): Promise<string | null> {
  try {
    const exists = await FileSystem.getInfoAsync(path);
    if (!exists.exists) return null;
    try {
      return await FileSystem.readAsStringAsync(path, { encoding: FileSystem.EncodingType.UTF8 });
    } catch (readErr) {
      // Try reading as base64 and return an annotated string so caller can see the content
      try {
        const b64 = await FileSystem.readAsStringAsync(path, { encoding: FileSystem.EncodingType.Base64 });
        return `BASE64:${b64}`;
      } catch (readErr2) {
        console.warn('FileSystem.readAsStringAsync failed (utf8 & base64)', readErr, readErr2);
        return null;
      }
    }
  } catch (e) {
    console.warn('FileSystem.readAsStringAsync failed', e);
    return null;
  }
}

async function fileSet(path: string, value: string): Promise<void> {
  try {
    const dir = path.replace(/\\/g, '/').split('/').slice(0, -1).join('/');
    try { await FileSystem.makeDirectoryAsync(dir, { intermediates: true }); } catch (e) { /* ignore if exists */ }
    await FileSystem.writeAsStringAsync(path, value, { encoding: FileSystem.EncodingType.UTF8 });
  } catch (e) {
    console.warn('FileSystem.writeAsStringAsync failed', e);
    throw e;
  }
}

export const SafeUserDataProvider = ({ children, initialUserId }: { children: ReactNode; initialUserId?: string }) => {
  const [userId, setUserId] = useState<string | undefined>(initialUserId ?? undefined);

  // Keep internal userId synced with the initialUserId prop passed from layout.
  // This avoids a race where the provider mounts before layout's async session
  // check completes and functions then see `No user set` despite the layout
  // later providing the id.
  useEffect(() => {
    setUserId(initialUserId ?? undefined);
  }, [initialUserId]);

  // initialUserId may still be referenced in some places; keep a local alias for clarity
  const providedUserId = initialUserId ?? undefined;

  // Store files under the app's documents folder. No network or DB access performed here.
  const storageKey = (uid?: string) => {
    const uidKey = uid ?? userId ?? providedUserId;
    const name = uidKey ? `user-${uidKey}.flo` : 'flo-legacy.json';
    return `${FileSystem.documentDirectory}flo/${name}`;
  };

  const passkeyStoreKey = (uid?: string) => {
    const uidKey = uid ?? userId ?? providedUserId;
    if (!uidKey) return null;
    return `flo-passkey-${uidKey}`;
  };

  async function setPasskey(passkey: string) {
    const key = passkeyStoreKey();
    if (!key) throw new Error('No user set');
    await SecureStore.setItemAsync(key, passkey);
  }

  async function getPasskey() {
    const key = passkeyStoreKey();
    if (!key) throw new Error('No user set');
    const val = await SecureStore.getItemAsync(key);
    return val;
  }

  // In-memory session passkey cache (cleared when app backgrounds/exits)
  const sessionPasskeyRef = useRef<string | null>(null);

  function activateSessionPasskey(passkey: string) {
    sessionPasskeyRef.current = passkey;
  }

  function clearSessionPasskey() {
    sessionPasskeyRef.current = null;
  }

  // (Previously had a helper to combine passkey+uid; now combine inside encrypt/decrypt functions.)

  async function clearPasskey() {
    const key = passkeyStoreKey();
    if (!key) throw new Error('No user set');
    await SecureStore.deleteItemAsync(key);
  }

  // Returns true if a passkey exists in SecureStore for the current user
  async function getPasskeyExists(): Promise<boolean> {
    const key = passkeyStoreKey();
    if (!key) throw new Error('No user set');
    try {
      const v = await SecureStore.getItemAsync(key);
      return v !== null && v !== undefined;
    } catch (e) {
      return false;
    }
  }

  async function resolveStoredOrProvidedPasskey(uid: string, provided?: string) {
    if (provided) return provided;
    // prefer in-memory session passkey if present
    if (sessionPasskeyRef.current) return sessionPasskeyRef.current;
    try {
      const stored = await getPasskey();
      return stored ?? null;
    } catch (e) {
      return null;
    }
  }

  // Clear session passkey when app backgrounds to ensure key is ephemeral
  useEffect(() => {
    const handler = (nextAppState: AppStateStatus) => {
      if (nextAppState !== 'active') {
        sessionPasskeyRef.current = null;
      }
    };
    const sub = AppState.addEventListener('change', handler);
    return () => { sub.remove(); };
  }, []);

  // Delete the raw flo file for the user
  async function deleteRaw(uid?: string) {
    const path = storageKey(uid ?? userId);
    try {
      await FileSystem.deleteAsync(path!, { idempotent: true });
    } catch (e) {
      console.warn('Failed to delete flo file', path, e);
      throw e;
    }
  }

  // Per-category in-memory cache (cleared when user or session changes)
  const categoryCacheRef = useRef<Record<string, any> | null>(null);

  // In-flight read promises to dedupe concurrent decrypt/read requests per category
  const inflightReadsRef = useRef<Record<string, Promise<any>>>({});

  // Cache the last-read raw file and its parsed object to avoid re-parsing/decrypting whole-file repeatedly
  const parsedFileRef = useRef<{ raw?: string | null; parsed?: FloData | null }>({ raw: undefined, parsed: null });

  function getCachedCategory(category: string) {
    try {
      return categoryCacheRef.current ? categoryCacheRef.current[category] : null;
    } catch (e) {
      return null;
    }
  }

  // Helper: deep-equal cheap check using JSON stringify (best-effort)
  function _deepEqual(a: any, b: any) {
    try { return JSON.stringify(a) === JSON.stringify(b); } catch (e) { return false; }
  }

  function setUser(uid?: string) {
    setUserId(uid);
  }

  // Load raw blob from secure store (no decryption)
  async function loadRaw(uid?: string): Promise<string | null> {
    const path = storageKey(uid ?? userId);
    return await fileGet(path!);
  }

  // Save raw blob to local file (already encrypted if needed)
  async function saveRaw(raw: string, uid?: string) {
    const path = storageKey(uid ?? userId);
    await fileSet(path!, raw);
  }

  // Generic read category: loads secure store, decrypts if encrypted (requires passkey), returns the category object
  async function readCategory(category: string, passkey?: string): Promise<any> {
    const uid = userId ?? providedUserId;
    if (!uid) throw new Error('No user set');

    // Return cached value if present
    try {
      if (categoryCacheRef.current && Object.prototype.hasOwnProperty.call(categoryCacheRef.current, category)) {
        return categoryCacheRef.current![category];
      }
    } catch (e) { /* ignore cache access errors */ }

    // If a read for this category is already in-flight, reuse the promise
    if (Object.prototype.hasOwnProperty.call(inflightReadsRef.current, category)) {
      try { return await inflightReadsRef.current[category]; } catch (e) { throw e; }
    }

    // Create an inflight promise to dedupe concurrent reads
    const p = (async () => {
      const raw = await loadRaw(uid);
      if (!raw) return undefined;

      // Two possible storage modes exist:
      // 1) legacy whole-file encrypted blob: raw starts with PREFIX -> decrypt whole file
      // 2) new per-category encryption: raw is plaintext JSON but individual category
      //    values may be encrypted strings starting with PREFIX. We handle both.

      let parsed: FloData | null = null;

      // If raw equals previously cached raw, reuse parsed object to avoid re-decrypt/parse
      if (parsedFileRef.current && parsedFileRef.current.raw === raw && parsedFileRef.current.parsed) {
        parsed = parsedFileRef.current.parsed as FloData;
      } else {
        if (typeof raw === 'string' && raw.startsWith(PREFIX)) {
          // Legacy whole-file encryption: need a passkey to decrypt entire payload
          const rawPass = await resolveStoredOrProvidedPasskey(uid, passkey as string | undefined);
          if (!rawPass) throw new Error('Passkey required to decrypt data');
          const decrypted = decryptString(raw, uid, rawPass);
          try {
            parsed = JSON.parse(decrypted) as FloData;
          } catch (e) { throw new Error('Failed to parse decrypted data'); }
        } else {
          // Plain JSON file; parse it and inspect the requested category only
          try {
            parsed = JSON.parse(String(raw)) as FloData;
          } catch (e) {
            // malformed JSON
            throw new Error('Failed to parse stored data');
          }
        }
        // cache parsed file
        try { parsedFileRef.current = { raw: raw, parsed }; } catch (e) { /* ignore */ }
      }

      // If the requested category is a string that is itself encrypted, decrypt it
      const value = parsed ? (parsed as any)[category] : undefined;
      if (typeof value === 'string' && value.startsWith(PREFIX)) {
        const rawPass = await resolveStoredOrProvidedPasskey(uid, passkey as string | undefined);
        if (!rawPass) throw new Error('Passkey required to decrypt data');
        let decrypted = decryptString(value, uid, rawPass);
        try {
          const parsedOnce = JSON.parse(decrypted);
          const out = typeof parsedOnce === 'string' ? JSON.parse(parsedOnce) : parsedOnce;
          // cache decrypted category
          try { categoryCacheRef.current = categoryCacheRef.current ?? {}; categoryCacheRef.current[category] = out; } catch (e) { /* ignore */ }
          return out;
        } catch (e) {
          // not JSON, return raw decrypted string and cache
          try { categoryCacheRef.current = categoryCacheRef.current ?? {}; categoryCacheRef.current[category] = decrypted; } catch (err) { /* ignore */ }
          return decrypted;
        }
      }

      // cache category value for quick synchronous reads
      try { categoryCacheRef.current = categoryCacheRef.current ?? {}; categoryCacheRef.current[category] = value; } catch (e) { /* ignore cache failures */ }
      return value;
    })();

    inflightReadsRef.current[category] = p;
    try {
      const res = await p;
      return res;
    } finally {
      // ensure we clear inflight after completion
      try { delete inflightReadsRef.current[category]; } catch (e) { /* ignore */ }
    }
  }

  // Generic write category: decrypts, sets category, re-encrypts and saves. Locks immediately after.
  async function writeCategory(category: string, payload: any, passkey?: string): Promise<void> {
    const uid = userId ?? providedUserId;
    if (!uid) throw new Error('No user set');
    // Load existing
    const raw = await loadRaw(uid);
    let data: FloData = { user: uid, journal: {} };
    if (raw) {
      if (typeof raw === 'string' && raw.startsWith(PREFIX)) {
        // Legacy whole-file encrypted: require passkey to read then migrate to per-category storage
        const effectiveForRead = passkey ?? (await (async () => { try { return await getPasskey(); } catch { return undefined; } })());
        if (!effectiveForRead) throw new Error('Passkey required to decrypt data');
        const decrypted = decryptString(raw, uid, effectiveForRead);
        try { data = JSON.parse(decrypted) as FloData; } catch (e) { data = { user: uid, journal: {} }; }
      } else {
        try { data = JSON.parse(String(raw)) as FloData; } catch (e) { data = { user: uid, journal: {} }; }
      }
    }
    // Determine effective passkey for writing (if provided or stored)
    let effective: string | undefined = passkey as string | undefined;
    if (!effective) {
      try { const gp = await getPasskey(); if (gp) effective = gp; } catch (e) { /* ignore */ }
    }

    // For journal category, require a passkey to avoid writing plaintext journal data
    if (category === 'journal' && !effective) {
      console.log('setkeylogiclater');
      throw new Error('Passkey required to save journal');
    }

    // Avoid redundant writes: if cached value equals payload, skip
    try {
      const cached = categoryCacheRef.current ? categoryCacheRef.current[category] : undefined;
      if (cached !== undefined && _deepEqual(cached, payload)) {
        // nothing to do
        return;
      }
    } catch (e) { /* ignore equality errors */ }

    // If we have an effective passkey, encrypt only the category payload and store as string
    if (effective) {
      const toEncrypt = JSON.stringify(payload);
      const encryptedCategory = encryptString(toEncrypt, uid, effective);
      (data as any)[category] = encryptedCategory;
    } else {
      // store as plaintext value
      (data as any)[category] = payload;
    }

    // Do not persist the user id in plaintext. Remove any user field before saving.
    try { delete (data as any).user; } catch (e) { /* ignore */ }

    // Save the JSON file (per-category encryption stored as strings inside)
    const finalStore = JSON.stringify(data);
    await saveRaw(finalStore, uid);
    // update in-memory cache
    try {
      categoryCacheRef.current = categoryCacheRef.current ?? {};
      categoryCacheRef.current[category] = payload;
      // update parsed file cache
      try { parsedFileRef.current = { raw: finalStore, parsed: data }; } catch (e) { /* ignore */ }
    } catch (e) { /* ignore */ }
  }

  // Journal helpers that decrypt/update/encrypt per operation
  async function listJournalEntries(passkey?: string): Promise<Entry[]> {
    // Use readCategory which handles per-category decryption and legacy whole-file blobs
    try {
      const journalObj = (await readCategory('journal', passkey)) ?? {};
      const journal = typeof journalObj === 'object' ? journalObj as JournalMap : {};
      const previews = Object.values(journal).map((e) => {
        const lines = (e.body || '').split('\n').slice(0, 3);
        let previewBody = lines.join('\n');
        if (previewBody.length > 300) previewBody = previewBody.slice(0, 300) + '…';
        return { ...e, body: previewBody } as Entry;
      });
      return previews.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch (e) {
      // If decryption fails or no journal, return empty list
      return [];
    }
  }

  async function createJournalEntry(input: Omit<Entry, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }, passkey?: string): Promise<void> {
    const uid = userId ?? providedUserId;
    if (!uid) throw new Error('No user set');

    // Read current journal (handles decryption)
    const journal = (await readCategory('journal', passkey)) ?? {};

    const now = new Date().toISOString();
    const id = input.id ?? `${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
    const entry: Entry = {
      id,
      title: input.title,
      body: input.body || '',
      date: input.date,
      createdAt: now,
      updatedAt: now,
    };

    const journalMap = typeof journal === 'object' ? journal as JournalMap : {};
    journalMap[id] = entry;

    // writeCategory will encrypt the journal category if passkey provided
    await writeCategory('journal', journalMap, passkey);
    return;
  }

  async function updateJournalEntry(id: string, patch: Partial<Entry>, passkey?: string): Promise<void> {
  const uid = userId ?? providedUserId;
  if (!uid) throw new Error('No user set');

  const journal = (await readCategory('journal', passkey)) ?? {};
  const journalMap = typeof journal === 'object' ? journal as JournalMap : {};
  if (!journalMap[id]) return;
  const existing = journalMap[id];
  const updated: Entry = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  journalMap[id] = updated;

  await writeCategory('journal', journalMap, passkey);
  return;
  }

  async function deleteJournalEntry(id: string, passkey?: string): Promise<void> {
  const uid = userId ?? providedUserId;
  if (!uid) throw new Error('No user set');

  const journal = (await readCategory('journal', passkey)) ?? {};
  const journalMap = typeof journal === 'object' ? journal as JournalMap : {};
  if (!journalMap[id]) return;
  delete journalMap[id];

  await writeCategory('journal', journalMap, passkey);
  return;
  }

  // Return the raw file contents and whether it is encrypted. If passkey is provided and the file
  // is encrypted, also return the decrypted plaintext in `decrypted`.
  async function fetchRawFlo(passkey?: string): Promise<{ raw: string | null; isEncrypted: boolean; decrypted?: string; path: string; base64Decoded?: string; info?: { exists: boolean; size?: number; modificationTime?: number; readError?: string } }> {
    const uid = userId ?? providedUserId;
    if (!uid) throw new Error('No user set');
    const path = storageKey(uid);
  let info: { exists: boolean; size?: number; modificationTime?: number; readError?: string } | undefined;
    try {
      const stat = await FileSystem.getInfoAsync(path);
      info = { exists: !!stat.exists };
      // size/modificationTime may not be present on all SDKs, include them if available
      if ((stat as any).size) info.size = (stat as any).size;
      if ((stat as any).modificationTime) info.modificationTime = (stat as any).modificationTime;
    } catch (e) {
      info = { exists: false };
    }

    const raw = await loadRaw(uid);
    if (!raw) {
      // file exists but couldn't be read, add diagnostic
      if (info && info.exists) info.readError = 'file exists but could not be read (encoding?)';
      return { raw: null, isEncrypted: false, path, info };
    }

    const isEncrypted = typeof raw === 'string' && raw.startsWith(PREFIX);
    // If file was returned as BASE64:..., try to decode it to UTF-8 to reveal any BROM_ prefix
  if (typeof raw === 'string' && raw.startsWith('BASE64:')) {
      const b64 = raw.substring('BASE64:'.length);
      try {
        const words = CryptoJS.enc.Base64.parse(b64);
        // Decode using WordArray->Uint8Array -> TextDecoder path to avoid artifacts
        let decoded = '';
        try {
          const u8 = ((): Uint8Array => {
            const wa = words as CryptoJS.lib.WordArray;
            const wordsArr = wa.words;
            const sigBytes = wa.sigBytes;
            const out = new Uint8Array(sigBytes);
            let off = 0;
            for (let wi = 0; wi < wordsArr.length; wi++) {
              let w = wordsArr[wi];
              for (let b = 3; b >= 0 && off < sigBytes; b--) {
                out[off++] = (w >>> (8 * b)) & 0xff;
              }
            }
            return out;
          })();
          if (typeof TextDecoder !== 'undefined') {
            try { decoded = new TextDecoder('utf-8').decode(u8); } catch (e) { decoded = new TextDecoder('iso-8859-1').decode(u8); }
          } else {
            // fallback
            let latin1 = '';
            for (let i = 0; i < u8.length; i++) latin1 += String.fromCharCode(u8[i]);
            try { decoded = decodeURIComponent(escape(latin1)); } catch (e) { decoded = latin1; }
          }
        } catch (e) {
          try { decoded = words.toString(CryptoJS.enc.Latin1); decoded = decodeURIComponent(escape(decoded)); } catch (e2) { /* ignore */ }
        }
        const decodedIsEncrypted = decoded.startsWith(PREFIX);
          if (decodedIsEncrypted) {
          const rawPass = await resolveStoredOrProvidedPasskey(uid, passkey as string | undefined);
          if (!rawPass) {
            console.log('setkeylogiclater');
            return { raw, isEncrypted: true, path, base64Decoded: decoded, info };
          }
          try {
            let decrypted = decryptString(decoded, uid, rawPass);
            try { const parsedOnce = JSON.parse(decrypted); if (typeof parsedOnce === 'string') decrypted = parsedOnce; } catch (e) { /* ignore */ }
            // Unescape JSON-like escape sequences if present
            if (typeof decrypted === 'string' && decrypted.includes('\\')) {
              try {
                const wrapped = `"${decrypted.replace(/"/g, '\\"')}"`;
                decrypted = JSON.parse(wrapped);
              } catch (e) {
                decrypted = decrypted.replace(/\\r\\n/g, '\r\n').replace(/\\n/g, '\n').replace(/\\\"/g, '"').replace(/\\'/g, "'").replace(/\\t/g, '\t').replace(/\\\\/g, '\\');
              }
            }
            return { raw, isEncrypted: true, decrypted, path, base64Decoded: decoded, info };
          } catch (e) {
            return { raw, isEncrypted: true, path, base64Decoded: decoded, info };
          }
        }
        // Not prefixed; return decoded as plaintext
        return { raw, isEncrypted: false, path, base64Decoded: decoded, info };
      } catch (e) {
        // could not decode base64 to utf8; return base64 only
        return { raw, isEncrypted: false, path, info };
      }
    }

    if (isEncrypted) {
      const rawPass = await resolveStoredOrProvidedPasskey(uid, passkey as string | undefined);
      if (!rawPass) {
        console.log('setkeylogiclater');
        return { raw, isEncrypted: true, path, info };
      }
      try {
        let decrypted = decryptString(raw, uid, rawPass);
        try { const parsedOnce = JSON.parse(decrypted); if (typeof parsedOnce === 'string') decrypted = parsedOnce; } catch (e) { /* ignore */ }
        if (typeof decrypted === 'string' && decrypted.includes('\\')) {
          try {
            const wrapped = `"${decrypted.replace(/"/g, '\\"')}"`;
            decrypted = JSON.parse(wrapped);
          } catch (e) {
            decrypted = decrypted.replace(/\\r\\n/g, '\r\n').replace(/\\n/g, '\n').replace(/\\\"/g, '"').replace(/\\'/g, "'").replace(/\\t/g, '\t').replace(/\\\\/g, '\\');
          }
        }
        return { raw, isEncrypted: true, decrypted, path, info };
      } catch (e) {
        return { raw, isEncrypted: true, path, info };
      }
    }

    return { raw, isEncrypted: false, path, info };
  }

  // List files under the flo/ directory so caller can inspect what files exist
  async function listFloFiles(): Promise<string[]> {
    const dir = `${FileSystem.documentDirectory}flo`;
    try {
      const exists = await FileSystem.getInfoAsync(dir);
      if (!exists.exists) return [];
      const files = await FileSystem.readDirectoryAsync(dir);
      return files;
    } catch (e) {
      console.warn('Failed to list flo dir', e);
      return [];
    }
  }

  const value: SafeUserDataContextValue = {
    userId,
    setUser,
    readCategory,
    writeCategory,
  fetchRawFlo,
  listFloFiles,
    listJournalEntries,
    // expose send-only methods for writers (editor/creator)
    sendCreateJournalEntry: async (input, passkey) => createJournalEntry(input, passkey),
    sendUpdateJournalEntry: async (id, patch, passkey) => updateJournalEntry(id, patch, passkey),
    sendDeleteJournalEntry: async (id, passkey) => deleteJournalEntry(id, passkey),
  setPasskey,
  getPasskey,
  getPasskeyExists,
  activateSessionPasskey,
  clearSessionPasskey,
  getCachedCategory,
  clearPasskey,
  deleteUserFlo: async () => deleteRaw(),
  };

  return <SafeUserDataContext.Provider value={value}>{children}</SafeUserDataContext.Provider>;
};

export default SafeUserDataProvider;