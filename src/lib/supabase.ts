import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Null when the env vars aren't set: the app still runs practice mode. */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: 'tow.auth' },
        realtime: { params: { eventsPerSecond: 20 } },
      })
    : null;

export const onlineAvailable = supabase !== null;

let sessionPromise: Promise<string> | null = null;

/**
 * Every device is an anonymous Supabase user: no sign-up, but a stable id that survives
 * reloads, so a dropped player can rejoin as themselves. Returns the access token.
 */
export function ensureSession(): Promise<string> {
  if (!supabase) return Promise.reject(new Error('Online play is not configured'));
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) return data.session.access_token;
      const { data: signed, error } = await supabase.auth.signInAnonymously();
      if (error || !signed.session) throw error ?? new Error('Could not sign in');
      return signed.session.access_token;
    })().catch((e) => {
      sessionPromise = null;
      throw e;
    });
  }
  return sessionPromise;
}
