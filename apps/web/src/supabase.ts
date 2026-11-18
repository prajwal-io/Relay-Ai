import { createClient } from '@supabase/supabase-js';

const env = (import.meta as any).env;
const url = env?.VITE_SUPABASE_URL;
const publishableKey = env?.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigured = Boolean(url && publishableKey);
export const supabase = supabaseConfigured
  ? createClient(url, publishableKey, { auth: { flowType: 'pkce', autoRefreshToken: true, persistSession: true, detectSessionInUrl: true } })
  : null;
