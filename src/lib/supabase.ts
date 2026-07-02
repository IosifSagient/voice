import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/supabase';

// SecureStore has a 2 KB per-key limit on iOS, so chunk large values.
const CHUNK_SIZE = 1800;
const chunkKey = (key: string, i: number) => `${key}.chunk.${i}`;

const secureStoreAdapter = {
  async getItem(key: string): Promise<string | null> {
    const count = await SecureStore.getItemAsync(chunkKey(key, -1));
    if (count === null) return SecureStore.getItemAsync(key);
    const chunks: string[] = [];
    for (let i = 0; i < Number(count); i++) {
      const chunk = await SecureStore.getItemAsync(chunkKey(key, i));
      if (chunk === null) return null;
      chunks.push(chunk);
    }
    return chunks.join('');
  },
  async setItem(key: string, value: string): Promise<void> {
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    const total = Math.ceil(value.length / CHUNK_SIZE);
    await SecureStore.setItemAsync(chunkKey(key, -1), String(total));
    for (let i = 0; i < total; i++) {
      await SecureStore.setItemAsync(
        chunkKey(key, i),
        value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
      );
    }
  },
  async removeItem(key: string): Promise<void> {
    const count = await SecureStore.getItemAsync(chunkKey(key, -1));
    if (count !== null) {
      await SecureStore.deleteItemAsync(chunkKey(key, -1));
      for (let i = 0; i < Number(count); i++) {
        await SecureStore.deleteItemAsync(chunkKey(key, i));
      }
    }
    await SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: secureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
