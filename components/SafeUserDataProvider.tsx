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
  journal?: {
    [chunkKey: string]: string; // e.g. "chunk_1(5/15)": "BROM_encrypted..."
  };
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
  readAllJournalChunks: (passkey?: string) => Promise<{ [chunkName: string]: JournalMap }>;
  listFloFiles: () => Promise<string[]>;
  sendCreateJournalEntry: (input: Omit<Entry, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }, passkey?: string) => Promise<void>;
  sendUpdateJournalEntry: (id: string, patch: Partial<Entry>, passkey?: string) => Promise<void>;
  sendDeleteJournalEntry: (id: string, passkey?: string) => Promise<void>;
  // Passkey management stored in SecureStore. Passkey is stored per-user until cleared.
  setPasskey: (passkey: string) => Promise<void>;
  getPasskey: () => Promise<string | null>;
  getPasskeyExists: () => Promise<boolean>;
  // Encrypted user profile stored inside the .flo under the `userinfo` key
  getUserProfile: (passkey?: string) => Promise<any | null>;
  saveUserProfile: (profile: any, passkey?: string) => Promise<void>;
  // Activate an in-memory session passkey (kept only while app is foregrounded)
  activateSessionPasskey: (passkey: string) => void;
  clearSessionPasskey: () => void;
  // Read cached category value synchronously (may be undefined/null)
  getCachedCategory: (category: string) => any | null;
  clearPasskey: () => Promise<void>;
  // Delete the user's .flo file from disk
  deleteUserFlo: () => Promise<void>;
  warmLatestJournalEntries?: (count: number) => Promise<void>;
  removeEmptyJournalChunks?: (passkey?: string) => Promise<void>;
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
    // Do NOT use any in-memory cached session passkey here. Always read the
    // stored passkey from SecureStore so we do not cache sensitive secrets in
    // memory. This function returns the stored passkey or null.
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
      // If asking for 'journal', return the aggregated cache
      if (category === 'journal') {
        const cache = categoryCacheRef.current ?? {};
        const agg = cache['journal'];
        if (agg && typeof agg === 'object' && Object.keys(agg).length > 0) return agg;
        return null;
      }
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

  // --- Chunking helpers for journal storage ---
  const JOURNAL_CHUNK_SIZE = 15;

  // Parse chunk key like "chunk_1(5/15)" to extract index and count
  function parseChunkKey(key: string): { index: number; count: number } | null {
    const m = key.match(/^chunk_(\d+)\((\d+)\/\d+\)$/);
    if (!m) return null;
    return { index: parseInt(m[1], 10), count: parseInt(m[2], 10) };
  }

  // Generate chunk key with embedded count: "chunk_1(5/15)"
  function makeChunkKey(index: number, count: number): string {
    return `chunk_${index}(${count}/${JOURNAL_CHUNK_SIZE})`;
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
          // Plain JSON file; parse it
          try {
            parsed = JSON.parse(String(raw)) as FloData;
          } catch (e) {
            throw new Error('Failed to parse stored data');
          }
        }
        // cache parsed file
        try { parsedFileRef.current = { raw: raw, parsed }; } catch (e) { /* ignore */ }
      }

      // Special handling for 'journal' category - aggregate all chunks
      if (category === 'journal' && parsed && parsed['journal']) {
        const journalChunks = parsed['journal'];
        const aggregated: JournalMap = {};
        
        for (const chunkKey of Object.keys(journalChunks)) {
          const encryptedPayload = journalChunks[chunkKey];
          if (typeof encryptedPayload === 'string' && encryptedPayload.startsWith(PREFIX)) {
            const rawPass = await resolveStoredOrProvidedPasskey(uid, passkey as string | undefined);
            if (!rawPass) throw new Error('Passkey required to decrypt data');
            const decrypted = decryptString(encryptedPayload, uid, rawPass);
            try {
              const chunkMap = JSON.parse(decrypted) as JournalMap;
              for (const id of Object.keys(chunkMap)) {
                aggregated[id] = chunkMap[id];
              }
            } catch (e) { /* skip malformed chunk */ }
          }
        }
        
        try { 
          categoryCacheRef.current = categoryCacheRef.current ?? {}; 
          categoryCacheRef.current[category] = aggregated; 
        } catch (e) { /* ignore */ }
        return aggregated;
      }

      // For other categories, return as-is
      let value: any = parsed ? (parsed as any)[category] : undefined;
      
      if (typeof value === 'string' && value.startsWith(PREFIX)) {
        const rawPass = await resolveStoredOrProvidedPasskey(uid, passkey as string | undefined);
        if (!rawPass) throw new Error('Passkey required to decrypt data');
        let decrypted = decryptString(value, uid, rawPass);
        try {
          const parsedOnce = JSON.parse(decrypted);
          const out = typeof parsedOnce === 'string' ? JSON.parse(parsedOnce) : parsedOnce;
          try { categoryCacheRef.current = categoryCacheRef.current ?? {}; categoryCacheRef.current[category] = out; } catch (e) { /* ignore */ }
          return out;
        } catch (e) {
          try { categoryCacheRef.current = categoryCacheRef.current ?? {}; categoryCacheRef.current[category] = decrypted; } catch (err) { /* ignore */ }
          return decrypted;
        }
      }

      try { categoryCacheRef.current = categoryCacheRef.current ?? {}; categoryCacheRef.current[category] = value; } catch (e) { /* ignore cache failures */ }
      return value;
    })();

    inflightReadsRef.current[category] = p;
    try {
      const res = await p;
      return res;
    } finally {
      try { delete inflightReadsRef.current[category]; } catch (e) { /* ignore */ }
    }
  }

  // Read all journal chunks and return a map of maps
  async function readAllJournalChunks(passkey?: string): Promise<{ [chunkName: string]: JournalMap }> {
    const uid = userId ?? providedUserId;
    if (!uid) throw new Error('No user set');
    
    const raw = await loadRaw(uid);
    if (!raw) return {};
    
    let parsed: FloData | null = null;
    
    if (typeof raw === 'string' && raw.startsWith(PREFIX)) {
      const rawPass = await resolveStoredOrProvidedPasskey(uid, passkey as string | undefined);
      if (!rawPass) throw new Error('Passkey required to decrypt data');
      const decrypted = decryptString(raw, uid, rawPass);
      try {
        parsed = JSON.parse(decrypted) as FloData;
      } catch (e) { return {}; }
    } else {
      try {
        parsed = JSON.parse(String(raw)) as FloData;
      } catch (e) { return {}; }
    }
    
    if (!parsed || !parsed['journal']) return {};
    
    const out: { [chunkName: string]: JournalMap } = {};
    const journalChunks = parsed['journal'];
    
    for (const chunkKey of Object.keys(journalChunks)) {
      const encryptedPayload = journalChunks[chunkKey];
      if (typeof encryptedPayload === 'string' && encryptedPayload.startsWith(PREFIX)) {
        const rawPass = await resolveStoredOrProvidedPasskey(uid, passkey as string | undefined);
        if (!rawPass) throw new Error('Passkey required to decrypt data');
        try {
          const decrypted = decryptString(encryptedPayload, uid, rawPass);
          const chunkMap = JSON.parse(decrypted) as JournalMap;
          out[chunkKey] = chunkMap;
        } catch (e) { out[chunkKey] = {}; }
      } else {
        out[chunkKey] = {};
      }
    }
    
    return out;
  }

  // Warm the latest `count` journal entries into the in-memory cache
  async function warmLatestJournalEntries(count: number) {
    const uid = userId ?? providedUserId;
    if (!uid) return;
    
    try {
      const effectivePass = await resolveStoredOrProvidedPasskey(uid);
      const allChunks = await readAllJournalChunks(effectivePass ?? undefined);
      
      let allEntries: Entry[] = [];
      
      // Sort chunk keys by index (descending) to read newest first
      const chunkKeys = Object.keys(allChunks).sort((a, b) => {
        const aInfo = parseChunkKey(a);
        const bInfo = parseChunkKey(b);
        if (!aInfo || !bInfo) return 0;
        return bInfo.index - aInfo.index;
      });
      
      for (const chunkKey of chunkKeys) {
        const chunkMap = allChunks[chunkKey];
        const entries = Object.values(chunkMap) as Entry[];
        allEntries.push(...entries);
        if (allEntries.length >= count) break;
      }
      
      // Sort all collected entries newest->oldest and take top `count`
      allEntries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const take = allEntries.slice(0, count);
      const aggregated: JournalMap = {};
      for (const e of take) aggregated[e.id] = e;
      
      try {
        categoryCacheRef.current = categoryCacheRef.current ?? {};
        categoryCacheRef.current['journal'] = aggregated;
      } catch (e) { /* ignore */ }
    } catch (e) {
      return;
    }
  }

  // Find the first chunk index that has room (< CHUNK_SIZE)
  async function findChunkIndexWithRoom(passkey?: string): Promise<number> {
    const uid = userId ?? providedUserId;
    if (!uid) return 1;
    
    const allChunks = await readAllJournalChunks(passkey);
    const chunkKeys = Object.keys(allChunks);
    
    if (chunkKeys.length === 0) return 1;
    
    // Parse all chunk indices
    const indices = chunkKeys
      .map(parseChunkKey)
      .filter((info): info is { index: number; count: number } => info !== null)
      .sort((a, b) => a.index - b.index);
    
    // Find first chunk with room
    for (const info of indices) {
      if (info.count < JOURNAL_CHUNK_SIZE) {
        return info.index;
      }
    }
    
    // All chunks are full, return next index
    const maxIdx = indices.length > 0 ? Math.max(...indices.map(i => i.index)) : 0;
    return maxIdx + 1;
  }

  // Generic write category: saves the category with nested chunk structure for journal
  async function writeCategory(category: string, payload: any, passkey?: string): Promise<void> {
    const uid = userId ?? providedUserId;
    if (!uid) throw new Error('No user set');
    
    // Load existing
    const raw = await loadRaw(uid);
    let data: FloData = { journal: {} };
    
    if (raw) {
      if (typeof raw === 'string' && raw.startsWith(PREFIX)) {
        const effectiveForRead = passkey ?? (await (async () => { try { return await getPasskey(); } catch { return undefined; } })());
        if (!effectiveForRead) throw new Error('Passkey required to decrypt data');
        const decrypted = decryptString(raw, uid, effectiveForRead);
        try { data = JSON.parse(decrypted) as FloData; } catch (e) { data = { journal: {} }; }
      } else {
        try { data = JSON.parse(String(raw)) as FloData; } catch (e) { data = { journal: {} }; }
      }
    }
    
    // Ensure journal object exists
    if (!data.journal) data.journal = {};
    
    // Determine effective passkey
    let effective: string | undefined = passkey as string | undefined;
    if (!effective) {
      try { const gp = await getPasskey(); if (gp) effective = gp; } catch (e) { /* ignore */ }
    }

    // For non-journal categories, write normally. For journal writes, use
    // writeJournalChunk which handles chunking and encryption.
    if (category !== 'journal') {
      if (effective) {
        const toEncrypt = JSON.stringify(payload);
        const encryptedCategory = encryptString(toEncrypt, uid, effective);
        (data as any)[category] = encryptedCategory;
      } else {
        (data as any)[category] = payload;
      }
    } else {
      throw new Error('Use writeJournalChunk to write journal data');
    }

    // Do not persist the user id in plaintext
    try { delete (data as any).user; } catch (e) { /* ignore */ }

    const finalStore = JSON.stringify(data);
    await saveRaw(finalStore, uid);

    // Update caches
    try { parsedFileRef.current = { raw: finalStore, parsed: data }; } catch (e) { /* ignore */ }
    try { categoryCacheRef.current = categoryCacheRef.current ?? {}; categoryCacheRef.current[category] = payload; } catch (e) { /* ignore */ }
  }

  // Internal helper to write a specific journal chunk
  async function writeJournalChunk(chunkIndex: number, chunkMap: JournalMap, passkey?: string): Promise<void> {
    const uid = userId ?? providedUserId;
    if (!uid) throw new Error('No user set');

    // Load existing
    const raw = await loadRaw(uid);
    let data: FloData = { journal: {} };
    if (raw) {
      if (typeof raw === 'string' && raw.startsWith(PREFIX)) {
        const effectiveForRead = passkey ?? (await (async () => { try { return await getPasskey(); } catch { return undefined; } })());
        if (!effectiveForRead) throw new Error('Passkey required to decrypt data');
        const decrypted = decryptString(raw, uid, effectiveForRead);
        try { data = JSON.parse(decrypted) as FloData; } catch (e) { data = { journal: {} }; }
      } else {
        try { data = JSON.parse(String(raw)) as FloData; } catch (e) { data = { journal: {} }; }
      }
    }

    if (!data.journal) data.journal = {};

    // Determine effective passkey for writing
    let effective: string | undefined = passkey as string | undefined;
    if (!effective) {
      try { const gp = await getPasskey(); if (gp) effective = gp; } catch (e) { /* ignore */ }
    }
    if (!effective) throw new Error('Passkey required to save journal');

    const count = Object.keys(chunkMap).length;
    const chunkKey = makeChunkKey(chunkIndex, count);
    const toEncrypt = JSON.stringify(chunkMap);
    const encrypted = encryptString(toEncrypt, uid, effective);

    // remove any existing keys for this index
    for (const k of Object.keys(data.journal)) {
      const info = parseChunkKey(k);
      if (info && info.index === chunkIndex) delete data.journal[k];
    }

    data.journal[chunkKey] = encrypted;

    try { delete (data as any).user; } catch (e) { /* ignore */ }
    const finalStore = JSON.stringify(data);
    await saveRaw(finalStore, uid);

    try { parsedFileRef.current = { raw: finalStore, parsed: data }; } catch (e) { /* ignore */ }
    try { if (categoryCacheRef.current) delete categoryCacheRef.current['journal']; } catch (e) { /* ignore */ }
  }

  // Journal helpers
  async function listJournalEntries(passkey?: string): Promise<Entry[]> {
    try {
      const allChunks = await readAllJournalChunks(passkey);
      const combined: Entry[] = [];
      for (const chunkName of Object.keys(allChunks)) {
        const chunk = allChunks[chunkName] ?? {};
        for (const e of Object.values(chunk)) {
          const lines = (e.body || '').split('\n').slice(0, 3);
          let previewBody = lines.join('\n');
          if (previewBody.length > 300) previewBody = previewBody.slice(0, 300) + '…';
          combined.push({ ...e, body: previewBody } as Entry);
        }
      }
      return combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (e) {
      return [];
    }
  }

  async function createJournalEntry(input: Omit<Entry, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }, passkey?: string): Promise<void> {
    const uid = userId ?? providedUserId;
    if (!uid) throw new Error('No user set');
    
    const now = new Date().toISOString();
    const id = input.id ?? `${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
    
    const MAX_ENTRY_CHARS = 15000;
    const safeTitle = (input.title || '').slice(0, 1024);
    const safeBody = (input.body || '').slice(0, MAX_ENTRY_CHARS);
    const entry: Entry = {
      id,
      title: safeTitle,
      body: safeBody,
      date: input.date,
      createdAt: now,
      updatedAt: now,
    };

    // Find a chunk with room
    const chunkIdx = await findChunkIndexWithRoom(passkey);
    
    // Read that specific chunk
    const allChunks = await readAllJournalChunks(passkey);
    const existingChunkKey = Object.keys(allChunks).find(k => {
      const info = parseChunkKey(k);
      return info && info.index === chunkIdx;
    });
    
    const target = existingChunkKey ? { ...allChunks[existingChunkKey] } : {};
    target[id] = entry;
    
    await writeJournalChunk(chunkIdx, target, passkey);
  }

  async function updateJournalEntry(id: string, patch: Partial<Entry>, passkey?: string): Promise<void> {
    const uid = userId ?? providedUserId;
    if (!uid) throw new Error('No user set');
    
    const allChunks = await readAllJournalChunks(passkey);
    let foundChunkKey: string | null = null;
    let foundChunkIndex: number | null = null;
    
    for (const ckey of Object.keys(allChunks)) {
      const chunk = allChunks[ckey] ?? {};
      if (chunk[id]) {
        foundChunkKey = ckey;
        const info = parseChunkKey(ckey);
        if (info) foundChunkIndex = info.index;
        break;
      }
    }
    
    if (!foundChunkKey || foundChunkIndex === null) return;
    
    const orig = allChunks[foundChunkKey] as JournalMap;
    const journalMap = { ...orig } as JournalMap;
    const existing = orig[id];
    
    const MAX_ENTRY_CHARS = 15000;
    const safeTitle = patch.title !== undefined ? (patch.title || '').slice(0, 1024) : existing.title;
    const safeBody = patch.body !== undefined ? (patch.body || '').slice(0, MAX_ENTRY_CHARS) : existing.body;
    const updated: Entry = { ...existing, ...patch, title: safeTitle, body: safeBody, updatedAt: new Date().toISOString() };
    
    journalMap[id] = updated;
    await writeJournalChunk(foundChunkIndex, journalMap, passkey);
  }

  async function deleteJournalEntry(id: string, passkey?: string): Promise<void> {
    const uid = userId ?? providedUserId;
    if (!uid) throw new Error('No user set');
    
    const allChunks = await readAllJournalChunks(passkey);
    let foundChunkKey: string | null = null;
    let foundChunkIndex: number | null = null;
    
    for (const ckey of Object.keys(allChunks)) {
      const chunk = allChunks[ckey] ?? {};
      if (chunk[id]) {
        foundChunkKey = ckey;
        const info = parseChunkKey(ckey);
        if (info) foundChunkIndex = info.index;
        break;
      }
    }
    
    if (!foundChunkKey || foundChunkIndex === null) return;
    
    const orig = allChunks[foundChunkKey] as JournalMap;
    const journalMap = { ...orig } as JournalMap;
    delete journalMap[id];
    
    await writeJournalChunk(foundChunkIndex, journalMap, passkey);
  }

  // Return the raw file contents and whether it is encrypted
  async function fetchRawFlo(passkey?: string): Promise<{ raw: string | null; isEncrypted: boolean; decrypted?: string; path: string; base64Decoded?: string; info?: { exists: boolean; size?: number; modificationTime?: number; readError?: string } }> {
    const uid = userId ?? providedUserId;
    if (!uid) throw new Error('No user set');
    const path = storageKey(uid);
    let info: { exists: boolean; size?: number; modificationTime?: number; readError?: string } | undefined;
    
    try {
      const stat = await FileSystem.getInfoAsync(path);
      info = { exists: !!stat.exists };
      if ((stat as any).size) info.size = (stat as any).size;
      if ((stat as any).modificationTime) info.modificationTime = (stat as any).modificationTime;
    } catch (e) {
      info = { exists: false };
    }

    const raw = await loadRaw(uid);
    if (!raw) {
      if (info && info.exists) info.readError = 'file exists but could not be read (encoding?)';
      return { raw: null, isEncrypted: false, path, info };
    }

    const isEncrypted = typeof raw === 'string' && raw.startsWith(PREFIX);
    
    if (typeof raw === 'string' && raw.startsWith('BASE64:')) {
      const b64 = raw.substring('BASE64:'.length);
      try {
        const words = CryptoJS.enc.Base64.parse(b64);
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
        return { raw, isEncrypted: false, path, base64Decoded: decoded, info };
      } catch (e) {
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

  // List files under the flo/ directory
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

  // Remove empty journal chunks
  async function removeEmptyJournalChunks(passkey?: string) {
    const uid = userId ?? providedUserId;
    if (!uid) throw new Error('No user set');
    
    const effective = passkey ?? (await getPasskey());
    const raw = await loadRaw(uid);
    if (!raw) return;
    
    let parsed: any = {};
    if (typeof raw === 'string' && raw.startsWith(PREFIX)) {
      if (!effective) throw new Error('Passkey required to modify data');
      const dec = decryptString(raw, uid, effective);
      parsed = JSON.parse(dec || '{}');
    } else {
      parsed = JSON.parse(String(raw || '{}'));
    }
    
    if (!parsed || !parsed['journal']) return;
    
    const journalObj = parsed['journal'];
    const toDelete: string[] = [];
    
    for (const chunkKey of Object.keys(journalObj)) {
      const encryptedPayload = journalObj[chunkKey];
      let count = 0;
      
      if (typeof encryptedPayload === 'string' && encryptedPayload.startsWith(PREFIX)) {
        if (effective) {
          try {
            const dec = decryptString(encryptedPayload, uid, effective);
            const chunkMap = JSON.parse(dec || '{}');
            count = Object.keys(chunkMap || {}).length;
          } catch (e) { count = 0; }
        }
      } else if (typeof encryptedPayload === 'object') {
        count = Object.keys(encryptedPayload).length;
      }
      
      if (count === 0) toDelete.push(chunkKey);
    }
    
    for (const k of toDelete) {
      delete journalObj[k];
    }
    
    parsed['journal'] = journalObj;
    
    const finalStore = JSON.stringify(parsed);
    await saveRaw(finalStore, uid);
  }

  // --- Encrypted user profile helpers stored under `userinfo` in the .flo ---
  async function getUserProfile(passkey?: string): Promise<any | null> {
    const uid = userId ?? providedUserId;
    if (!uid) throw new Error('No user set');

    const raw = await loadRaw(uid);
    if (!raw) return null;

    let parsed: FloData | null = null;
    if (typeof raw === 'string' && raw.startsWith(PREFIX)) {
      const rawPass = await resolveStoredOrProvidedPasskey(uid, passkey as string | undefined);
      if (!rawPass) throw new Error('Passkey required to decrypt data');
      const dec = decryptString(raw, uid, rawPass);
      try { parsed = JSON.parse(dec) as FloData; } catch (e) { return null; }
    } else {
      try { parsed = JSON.parse(String(raw)) as FloData; } catch (e) { return null; }
    }

    if (!parsed) return null;
    const val = (parsed as any)['userinfo'];
    if (!val) return null;

    if (typeof val === 'string' && val.startsWith(PREFIX)) {
      const rawPass = await resolveStoredOrProvidedPasskey(uid, passkey as string | undefined);
      if (!rawPass) throw new Error('Passkey required to decrypt data');
      try {
        const dec = decryptString(val, uid, rawPass);
        try { return JSON.parse(dec); } catch (e) { return dec; }
      } catch (e) { return null; }
    }

    return val;
  }

  async function saveUserProfile(profile: any, passkey?: string): Promise<void> {
    const uid = userId ?? providedUserId;
    if (!uid) throw new Error('No user set');

    // Load existing
    const raw = await loadRaw(uid);
    let data: FloData = { journal: {} };

    if (raw) {
      if (typeof raw === 'string' && raw.startsWith(PREFIX)) {
        const effectiveForRead = passkey ?? (await (async () => { try { return await getPasskey(); } catch { return undefined; } })());
        if (!effectiveForRead) throw new Error('Passkey required to decrypt data');
        const decrypted = decryptString(raw, uid, effectiveForRead);
        try { data = JSON.parse(decrypted) as FloData; } catch (e) { data = { journal: {} }; }
      } else {
        try { data = JSON.parse(String(raw)) as FloData; } catch (e) { data = { journal: {} }; }
      }
    }

    let effective: string | undefined = passkey as string | undefined;
    if (!effective) {
      try { const gp = await getPasskey(); if (gp) effective = gp; } catch (e) { /* ignore */ }
    }

    if (effective) {
      const toEncrypt = JSON.stringify(profile);
      const encrypted = encryptString(toEncrypt, uid, effective);
      (data as any)['userinfo'] = encrypted;
    } else {
      (data as any)['userinfo'] = profile;
    }

    try { delete (data as any).user; } catch (e) { /* ignore */ }
    const finalStore = JSON.stringify(data);
    await saveRaw(finalStore, uid);

    try { parsedFileRef.current = { raw: finalStore, parsed: data }; } catch (e) { /* ignore */ }
    try { categoryCacheRef.current = categoryCacheRef.current ?? {}; categoryCacheRef.current['userinfo'] = profile; } catch (e) { /* ignore */ }
  }

  const value: SafeUserDataContextValue = {
    userId,
    setUser,
    readCategory,
    writeCategory,
    fetchRawFlo,
    listFloFiles,
    listJournalEntries,
    readAllJournalChunks,
    warmLatestJournalEntries,
    removeEmptyJournalChunks,
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
  getUserProfile: async (passkey) => getUserProfile(passkey),
  saveUserProfile: async (profile, passkey) => saveUserProfile(profile, passkey),
  };

  return <SafeUserDataContext.Provider value={value}>{children}</SafeUserDataContext.Provider>;
};

export default SafeUserDataProvider;