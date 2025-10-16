import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import 'react-native-url-polyfill/auto'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // Log a warning so developers can detect misconfiguration
  console.warn('lib/supabase: EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY is missing; Supabase client not created.')
  throw new Error('Missing Supabase environment variables')
}

// allow reassigning the client when reconnecting
export let supabase: SupabaseClient = createClient(supabaseUrl!, supabaseAnonKey!, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

// guard to avoid recreating the client too often (prevents auth refresh storms)
let _lastReconnectAt = 0
const MIN_RECONNECT_INTERVAL_MS = 30_000 // 30s

// Simple rate-limited logger to avoid duplicate identical messages flooding the console
const _lastLogAt: Record<string, number> = {};
const MIN_LOG_INTERVAL_MS = 10_000; // 10s
function rateLimitedLog(key: string, ...args: any[]) {
  try {
    const now = Date.now();
    const last = _lastLogAt[key] ?? 0;
    if (now - last < MIN_LOG_INTERVAL_MS) return;
    _lastLogAt[key] = now;
    // Use console.log to preserve existing behavior
    // eslint-disable-next-line no-console
    console.log(...args);
  } catch (e) {
    // ignore logging errors
  }
}

export function reconnectSupabase() {
  const now = Date.now()
  if (now - _lastReconnectAt < MIN_RECONNECT_INTERVAL_MS) {
    console.warn('reconnectSupabase: skipped (rate-limited)')
    return false
  }
  _lastReconnectAt = now

  console.log('reconnectSupabase: recreating Supabase client')
  // Recreate the client instance (useful if the network stack needs a fresh client)
  supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  })
  return true
}

// Test connection
export async function testSupabaseConnection() {
  try {
    // First, ensure the auth layer responds. This avoids attempting row-level
    // protected selects before a session is established which cause RLS errors.
    try {
      const { data: { session } } = await supabase.auth.getSession();
      // If we have a session object the client/auth subsystem is healthy.
      if (session) {
        rateLimitedLog('supabase:auth_session_present', 'Supabase auth session present')
        return true
      }
    } catch (e) {
      // ignore - we'll fall back to a lightweight REST probe below
    }

    // Fallback: perform a lightweight REST probe to the Supabase REST root.
    // We don't issue any protected selects here; this request simply checks
    // that the Supabase HTTP endpoint is reachable and responding.
    const probeUrl = `${supabaseUrl}/rest/v1/`;
    try {
      const res = await fetch(probeUrl, {
        method: 'GET',
        headers: {
          apikey: supabaseAnonKey || '',
          Authorization: `Bearer ${supabaseAnonKey || ''}`,
        },
      });
      // If we get any HTTP response, the server is reachable. Treat network
      // or auth errors as "reachable" so reconnect logic doesn't spam when
      // the SDK hasn't established a session yet.
      if (res) {
        rateLimitedLog('supabase:rest_probe', 'Supabase REST endpoint reachable (status:', res.status, ')')
        return true
      }
    } catch (fetchErr) {
      console.error('Supabase REST probe failed:', fetchErr instanceof Error ? fetchErr.message : String(fetchErr));
      return false
    }

    // If we fell through, report failure.
    console.error('Supabase connection failed: unknown state')
    return false
  } catch (error) {
    console.error('Supabase connection failed:', error instanceof Error ? error.message : 'Unknown error')
    return false
  }
}

// Ensure the supabase client is connected; try reconnecting once if test fails
export async function ensureSupabaseConnected(retries = 3, delayMs = 1000) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const ok = await testSupabaseConnection()
    if (ok) return true
    console.warn(`Supabase not reachable (attempt ${attempt + 1}/${retries}), reconnecting...`)
    reconnectSupabase()
    // wait before next attempt
    await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)))
  }
  return false
}

// Default export to satisfy Expo Router when scanning files under app/
// Default export of a dummy component to prevent Expo Router from treating this file as a route
export function SupabaseRouteShim() { return null }

export default supabase