import { encodeBase64, decodeBase64 } from 'tweetnacl-util';
import {
  DeviceKeyPair,
  SerializedIdentity,
  generateDeviceKeyPair,
  exportPublicKeys,
} from './keygen';

export type { SerializedIdentity };

export interface TrustedContact {
  id: string; // Unique contact ID (composite or UUID)
  alias: string; // User-given friendly name (e.g. "PC do Murillo")
  userId: string;
  deviceId: string;
  deviceName: string;
  username: string;
  publicKeyEd: string;
  publicKeyDh: string;
  fingerprint: string;
  createdAt: number;
  lastCalledAt?: number;
}

const DB_NAME = 'ghostprotocol_vault_v2';
const DB_VERSION = 2;
const STORE_IDENTITY = 'identity_store';
const STORE_CONTACTS = 'contacts_store';
const KEY_IDENTITY = 'local_device_identity';

function openVaultDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_IDENTITY)) {
        db.createObjectStore(STORE_IDENTITY);
      }
      if (!db.objectStoreNames.contains(STORE_CONTACTS)) {
        db.createObjectStore(STORE_CONTACTS, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Detects device hardware platform for default naming and classification.
 */
export function detectDeviceType(): 'desktop' | 'mobile' | 'browser' {
  if (typeof window === 'undefined') return 'browser';
  const ua = navigator.userAgent.toLowerCase();
  if (/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
    return 'mobile';
  }
  if (/windows|macintosh|linux|cros/i.test(ua)) {
    return 'desktop';
  }
  return 'browser';
}

export function getDefaultDeviceName(): string {
  if (typeof window === 'undefined') return 'Ghost Node';
  const ua = navigator.userAgent;
  let os = 'Node';
  if (ua.includes('Win')) os = 'Windows PC';
  else if (ua.includes('Mac')) os = 'MacBook / Mac';
  else if (ua.includes('Linux')) os = 'Linux Station';
  else if (ua.includes('Android')) os = 'Android Mobile';
  else if (ua.includes('iPhone')) os = 'iPhone';
  else if (ua.includes('iPad')) os = 'iPad';

  const randomBytes = new Uint8Array(2);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randomBytes);
  }
  const suffix = 1000 + (((randomBytes[0] << 8) | randomBytes[1]) % 9000);
  return `${os} #${suffix}`;
}

/**
 * Saves serialized identity securely in client IndexedDB.
 */
export async function saveLocalIdentity(identity: SerializedIdentity): Promise<void> {
  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_IDENTITY, 'readwrite');
    const store = tx.objectStore(STORE_IDENTITY);
    const req = store.put(identity, KEY_IDENTITY);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Loads the existing local identity from IndexedDB.
 */
export async function loadLocalIdentity(): Promise<SerializedIdentity | null> {
  try {
    const db = await openVaultDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_IDENTITY, 'readonly');
      const store = tx.objectStore(STORE_IDENTITY);
      const req = store.get(KEY_IDENTITY);

      req.onsuccess = () => {
        resolve((req.result as SerializedIdentity) || null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[Storage] Error loading identity from IndexedDB:', err);
    return null;
  }
}

/**
 * Retrieves the existing identity or generates and persists a new zero-knowledge identity.
 */
export async function getOrCreateLocalIdentity(
  customUsername?: string,
  customDeviceName?: string
): Promise<SerializedIdentity> {
  const existing = await loadLocalIdentity();
  if (existing) {
    if (customUsername && existing.username !== customUsername) {
      existing.username = customUsername;
      await saveLocalIdentity(existing);
    }
    return existing;
  }

  // Generate brand new identity
  const keyPair = generateDeviceKeyPair();
  const pubKeys = exportPublicKeys(keyPair);
  const deviceType = detectDeviceType();
  const deviceName = customDeviceName || getDefaultDeviceName();

  const randSuffixBytes = new Uint8Array(2);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randSuffixBytes);
  }
  const userSuffix = 100 + (((randSuffixBytes[0] << 8) | randSuffixBytes[1]) % 900);
  const username = customUsername || `Operator_${userSuffix}`;
  const deviceId = crypto.randomUUID();
  const userId = crypto.randomUUID();

  const newIdentity: SerializedIdentity = {
    deviceId,
    deviceName,
    deviceType,
    userId,
    username,
    publicKeyEd: pubKeys.publicKeyEd,
    publicKeyDh: pubKeys.publicKeyDh,
    privateKeyEd: encodeBase64(keyPair.signKeyPair.secretKey),
    privateKeyDh: encodeBase64(keyPair.boxKeyPair.secretKey),
    createdAt: Date.now(),
  };

  // Securely persist exclusively in IndexedDB (do NOT store private keys in localStorage)
  await saveLocalIdentity(newIdentity);

  // Clean up any legacy plaintext private keys in localStorage
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(KEY_IDENTITY);
    } catch {
      // ignore
    }
  }

  return newIdentity;
}

/**
 * Wipes local identity completely (Zero-Knowledge Panic/Self-Destruct Button).
 */
export async function clearLocalIdentity(): Promise<void> {
  try {
    const db = await openVaultDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_IDENTITY, STORE_CONTACTS], 'readwrite');
      tx.objectStore(STORE_IDENTITY).clear();
      tx.objectStore(STORE_CONTACTS).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }

  if (typeof window !== 'undefined') {
    localStorage.removeItem(KEY_IDENTITY);
    localStorage.removeItem('ghostprotocol_contacts');
  }
}

// -------------------------------------------------------------
// TRUSTED CONTACTS & SAVED DEVICES VAULT (100% Client-Side)
// -------------------------------------------------------------

/**
 * Saves or updates a trusted device contact.
 */
export async function saveTrustedContact(contact: TrustedContact): Promise<void> {
  try {
    const db = await openVaultDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_CONTACTS, 'readwrite');
      const store = tx.objectStore(STORE_CONTACTS);
      const req = store.put(contact);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Fallback to localStorage
    if (typeof window !== 'undefined') {
      const contacts = getTrustedContactsFromLocalStorage();
      const idx = contacts.findIndex((c) => c.id === contact.id);
      if (idx >= 0) contacts[idx] = contact;
      else contacts.push(contact);
      localStorage.setItem('ghostprotocol_contacts', JSON.stringify(contacts));
    }
  }
}

/**
 * Lists all trusted contacts.
 */
export async function getTrustedContacts(): Promise<TrustedContact[]> {
  try {
    const db = await openVaultDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_CONTACTS, 'readonly');
      const store = tx.objectStore(STORE_CONTACTS);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return getTrustedContactsFromLocalStorage();
  }
}

/**
 * Deletes a trusted contact by ID.
 */
export async function deleteTrustedContact(id: string): Promise<void> {
  try {
    const db = await openVaultDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_CONTACTS, 'readwrite');
      const store = tx.objectStore(STORE_CONTACTS);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    if (typeof window !== 'undefined') {
      const contacts = getTrustedContactsFromLocalStorage().filter((c) => c.id !== id);
      localStorage.setItem('ghostprotocol_contacts', JSON.stringify(contacts));
    }
  }
}

/**
 * Updates a contact's custom nickname (e.g. "PC do Murillo").
 */
export async function updateContactAlias(id: string, newAlias: string): Promise<void> {
  const contacts = await getTrustedContacts();
  const contact = contacts.find((c) => c.id === id);
  if (contact) {
    contact.alias = newAlias;
    await saveTrustedContact(contact);
  }
}

export async function getContactByDeviceId(deviceId: string): Promise<TrustedContact | null> {
  const contacts = await getTrustedContacts();
  return contacts.find((c) => c.deviceId === deviceId) || null;
}

function getTrustedContactsFromLocalStorage(): TrustedContact[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem('ghostprotocol_contacts');
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}
