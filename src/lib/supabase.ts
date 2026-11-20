import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
// Supabase now calls this the "publishable" key; older projects call it the anon key. Either works.
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn('LENS: set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY in .env');
}

export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'missing', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/**
 * No sign-up screen for v1: every install gets an anonymous Supabase user so
 * free-scan limits can be enforced per person. It can be upgraded to a real
 * account later (e.g. Sign in with Apple at purchase time) without losing data.
 */
export async function ensureSession() {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;
  const { data: signIn, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return signIn.session;
}
