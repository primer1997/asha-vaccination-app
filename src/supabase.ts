import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Supabase credentials missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env"
  );
}

export const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * Ensures there is an active session. ASHA workers sign in anonymously
 * (no email needed) so the app can read the worker list under RLS.
 */
export async function ensureSession() {
  const { data } = await supabase.auth.getSession();
  if (data.session) return { session: data.session, error: null };
  const { data: anon, error } = await supabase.auth.signInAnonymously();
  return { session: anon.session ?? null, error };
}
