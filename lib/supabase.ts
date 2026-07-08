import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { secureStorage } from './secureStorage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Session persisted in the Keychain/Keystore on native (chunked), and in
    // AsyncStorage on web. See lib/secureStorage.ts.
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
