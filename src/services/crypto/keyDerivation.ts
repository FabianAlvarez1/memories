// =========================================================
// KEY DERIVATION — PBKDF2 + AES-256-GCM
// Web Crypto API (runs in browser/Capacitor WebView)
// =========================================================

const PBKDF2_ITERATIONS = 600_000;
const KEY_LENGTH = 256;
const HASH_ALGO = 'SHA-256';

/**
 * Encode string to Uint8Array
 */
function encode(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/**
 * Decode Uint8Array to string
 */
function decode(buf: ArrayBuffer): string {
  return new TextDecoder().decode(buf);
}

/**
 * ArrayBuffer ↔ base64 utilities
 */
export function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Generate a random salt (16 bytes)
 */
export function generateSalt(): string {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return bufferToBase64(salt.buffer);
}

/**
 * Derive AES-256-GCM CryptoKey from password + salt using PBKDF2
 */
export async function deriveKey(password: string, saltBase64: string): Promise<CryptoKey> {
  const saltBuffer = base64ToBuffer(saltBase64);

  // Import password as raw key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Derive AES-GCM key
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: HASH_ALGO,
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false, // not extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a string with AES-256-GCM
 * Returns: base64(iv) + ':' + base64(ciphertext)
 */
export async function encryptText(plaintext: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
  const encoded = encode(plaintext);

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );

  const ivB64 = bufferToBase64(iv.buffer);
  const cipherB64 = bufferToBase64(cipherBuffer);
  return `${ivB64}:${cipherB64}`;
}

/**
 * Decrypt a string encrypted with encryptText()
 */
export async function decryptText(encrypted: string, key: CryptoKey): Promise<string> {
  const [ivB64, cipherB64] = encrypted.split(':');
  if (!ivB64 || !cipherB64) throw new Error('Invalid encrypted format');

  const iv = base64ToBuffer(ivB64);
  const cipherBuffer = base64ToBuffer(cipherB64);

  const plainBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    cipherBuffer
  );

  return decode(plainBuffer);
}

/**
 * Encrypt an ArrayBuffer (for files)
 * Returns: { iv: base64, data: base64 }
 */
export async function encryptBuffer(
  buffer: ArrayBuffer,
  key: CryptoKey
): Promise<{ iv: string; data: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    buffer
  );

  return {
    iv: bufferToBase64(iv.buffer),
    data: bufferToBase64(cipherBuffer),
  };
}

/**
 * Decrypt an ArrayBuffer (for files)
 */
export async function decryptBuffer(
  ivB64: string,
  dataB64: string,
  key: CryptoKey
): Promise<ArrayBuffer> {
  const iv = base64ToBuffer(ivB64);
  const data = base64ToBuffer(dataB64);

  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
}

/**
 * Hash a password with SHA-256 (for verification without decrypting DB)
 * Note: Real auth uses PBKDF2; this is for quick local check only.
 */
export async function hashPassword(password: string): Promise<string> {
  const encoded = encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  return bufferToBase64(hashBuffer);
}

/**
 * Compute SHA-256 of an ArrayBuffer (for file integrity)
 */
export async function computeHash(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return bufferToBase64(hashBuffer);
}
