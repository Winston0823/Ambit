import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

/// Storage adapter for the Supabase auth session (the JWT + refresh token).
///
/// On native we keep the session in the iOS Keychain / Android Keystore via
/// expo-secure-store instead of plaintext AsyncStorage. SecureStore caps a
/// single value at ~2KB, and a Supabase session can exceed that, so values are
/// split into chunks under `<key>.<i>` with a count at `<key>.__count`.
///
/// On web (no SecureStore) we fall back to AsyncStorage, which is what the
/// Supabase client used everywhere before.

// ASCII-dominant session (JWTs) → char length ≈ byte length; 1500 stays safely
// under the 2KB per-item ceiling even with a few multi-byte characters.
const CHUNK_SIZE = 1500;
const COUNT_SUFFIX = '.__count';
const chunkKey = (key: string, i: number) => `${key}.${i}`;

async function getItem(key: string): Promise<string | null> {
  const countStr = await SecureStore.getItemAsync(key + COUNT_SUFFIX);
  if (countStr == null) {
    // Not chunked — could be a legacy single value written directly.
    return SecureStore.getItemAsync(key);
  }
  const count = parseInt(countStr, 10) || 0;
  let out = '';
  for (let i = 0; i < count; i++) {
    const part = await SecureStore.getItemAsync(chunkKey(key, i));
    if (part == null) return null; // partial/corrupt → treat as no session
    out += part;
  }
  return out;
}

async function removeItem(key: string): Promise<void> {
  const countStr = await SecureStore.getItemAsync(key + COUNT_SUFFIX);
  if (countStr != null) {
    const count = parseInt(countStr, 10) || 0;
    for (let i = 0; i < count; i++) await SecureStore.deleteItemAsync(chunkKey(key, i));
    await SecureStore.deleteItemAsync(key + COUNT_SUFFIX);
  }
  await SecureStore.deleteItemAsync(key); // clear any legacy direct value
}

async function setItem(key: string, value: string): Promise<void> {
  // Clear prior chunks first — a new (shorter) value must not leave stragglers.
  await removeItem(key);
  const parts: string[] = [];
  for (let i = 0; i < value.length; i += CHUNK_SIZE) {
    parts.push(value.slice(i, i + CHUNK_SIZE));
  }
  await SecureStore.setItemAsync(key + COUNT_SUFFIX, String(parts.length));
  for (let i = 0; i < parts.length; i++) {
    await SecureStore.setItemAsync(chunkKey(key, i), parts[i]);
  }
}

export const secureStorage =
  Platform.OS === 'web' ? AsyncStorage : { getItem, setItem, removeItem };
