import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';
import * as Random from 'expo-random';

type StoredMessage = {
  id: string;
  text: string;
  sender: 'user' | 'other';
  timestamp: string; // ISO
};

const USER_ID_KEY = 'florescer:userId';
const CONV_PREFIX = 'florescer:chat:';
const ENC_KEY_STORAGE = 'florescer:encKey';

function randPart(len: number) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function generateRandomKey() {
  // pattern similar to the example: 4-5-5-5
  return `${randPart(4)}-${randPart(5)}-${randPart(5)}-${randPart(5)}`;
}

export async function getOrCreateUserId(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(USER_ID_KEY);
    if (existing) return existing;
    const id = generateRandomKey();
    await AsyncStorage.setItem(USER_ID_KEY, id);
    return id;
  } catch (e) {
    // fallback to in-memory-like random id
    return generateRandomKey();
  }
}

export async function saveConversation(userId: string, messages: StoredMessage[]) {
  try {
    await AsyncStorage.setItem(CONV_PREFIX + userId, JSON.stringify(messages));
  } catch (e) {
    console.warn('Failed to save conversation', e);
  }
}

export async function loadConversation(userId: string): Promise<StoredMessage[] | null> {
  try {
    const raw = await AsyncStorage.getItem(CONV_PREFIX + userId);
    if (!raw) return null;
    return JSON.parse(raw) as StoredMessage[];
  } catch (e) {
    console.warn('Failed to load conversation', e);
    return null;
  }
}

export async function appendMessage(userId: string, message: StoredMessage) {
  try {
    const existing = await loadConversation(userId) || [];
    existing.push(message);
    await saveConversation(userId, existing);
  } catch (e) {
    console.warn('Failed to append message', e);
  }
}

export async function listConversations(): Promise<string[]> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    return keys.filter(k => k.startsWith(CONV_PREFIX)).map(k => k.replace(CONV_PREFIX, ''));
  } catch (e) {
    return [];
  }
}

export async function clearConversation(userId: string) {
  try {
    await AsyncStorage.removeItem(CONV_PREFIX + userId);
  } catch (e) {
    console.warn('Failed to clear conversation', e);
  }
}

export async function pushConversationToServer(userId: string, serverUrl = 'https://bromelia-server.onrender.com'): Promise<boolean> {
  try {
    const messages = await loadConversation(userId);
    if (!messages) {
      console.warn('No messages to push for user', userId);
      return false;
    }

    const response = await fetch(`${serverUrl}/logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ userId, messages }),
      credentials: 'omit',
      mode: 'cors',
    });

    if (!response.ok) {
      const text = await response.text();
      console.warn('Failed to push conversation:', response.status, text);
      return false;
    }

    return true;
  } catch (e) {
    console.warn('Error pushing conversation to server', e);
    return false;
  }
}

export async function pushMessageToServer(userId: string, message: StoredMessage, serverUrl = 'https://bromelia-server.onrender.com'): Promise<boolean> {
  try {
    const response = await fetch(`${serverUrl}/logs/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ userId, message }),
      credentials: 'omit',
      mode: 'cors',
    });

    if (!response.ok) {
      const text = await response.text();
      console.warn('Failed to push message:', response.status, text);
      return false;
    }

    return true;
  } catch (e) {
    console.warn('Error pushing message to server', e);
    return false;
  }
}

/**
 * Encryption helpers
 */
export async function getOrCreateEncryptionKey(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(ENC_KEY_STORAGE);
    if (existing) return existing;

    let keyHex = '';

    // Prefer secure native randomness from expo-random when available
    try {
      if (Random && typeof Random.getRandomBytesAsync === 'function') {
        const bytes = await Random.getRandomBytesAsync(16);
        keyHex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
      } else if (Random && typeof (Random as any).getRandomBytes === 'function') {
        const bytes = (Random as any).getRandomBytes(16);
        keyHex = Array.from(bytes as Uint8Array).map((b: number) => b.toString(16).padStart(2, '0')).join('');
      } else {
        // Fall back to CryptoJS secure generator
        keyHex = CryptoJS.lib.WordArray.random(16).toString();
      }
    } catch (e) {
      // If expo-random fails or isn't available, try CryptoJS
      try {
        keyHex = CryptoJS.lib.WordArray.random(16).toString();
      } catch (e2) {
        // Last resort: pseudo-random hex (not cryptographically secure)
        let out = '';
        for (let i = 0; i < 32; i++) out += Math.floor(Math.random() * 16).toString(16);
        keyHex = out;
      }
    }

    await AsyncStorage.setItem(ENC_KEY_STORAGE, keyHex);
    return keyHex;
  } catch (e) {
    // On any storage failure, return a best-effort pseudo-random key
    let out = '';
    for (let i = 0; i < 32; i++) out += Math.floor(Math.random() * 16).toString(16);
    return out;
  }
}

export function encryptText(plain: string, key: string): string {
  try {
    return CryptoJS.AES.encrypt(plain, key).toString();
  } catch (e) {
    console.warn('Encryption failed', e);
    return plain;
  }
}

export function decryptText(cipher: string, key: string): string {
  try {
    const bytes = CryptoJS.AES.decrypt(cipher, key);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (e) {
    console.warn('Decryption failed', e);
    return cipher;
  }
}

/**
 * Append an encrypted message (stores ciphertext locally).
 * Server will receive ciphertext-only if you use the pushEncrypted* helpers.
 */
export async function appendEncryptedMessage(userId: string, message: StoredMessage) {
  try {
    const key = await getOrCreateEncryptionKey();
    const encrypted: StoredMessage = { ...message, text: encryptText(message.text, key) };
    await appendMessage(userId, encrypted);
  } catch (e) {
    console.warn('Failed to append encrypted message', e);
  }
}

export async function pushEncryptedConversationToServer(userId: string, serverUrl = 'https://bromelia-server.onrender.com'): Promise<boolean> {
  try {
    const messages = await loadConversation(userId);
    if (!messages) return false;
    const key = await getOrCreateEncryptionKey();
    const encryptedMessages = messages.map(m => ({ ...m, text: encryptText(m.text, key) }));

    const response = await fetch(`${serverUrl}/logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ userId, messages: encryptedMessages }),
      credentials: 'omit',
      mode: 'cors',
    });

    if (!response.ok) {
      const text = await response.text();
      console.warn('Failed to push encrypted conversation:', response.status, text);
      return false;
    }

    return true;
  } catch (e) {
    console.warn('Error pushing encrypted conversation', e);
    return false;
  }
}

export async function pushEncryptedMessageToServer(userId: string, message: StoredMessage, serverUrl = 'https://bromelia-server.onrender.com'): Promise<boolean> {
  try {
    const key = await getOrCreateEncryptionKey();
    const encrypted = { ...message, text: encryptText(message.text, key) };
    return await pushMessageToServer(userId, encrypted, serverUrl);
  } catch (e) {
    console.warn('Error pushing encrypted message', e);
    return false;
  }
}
