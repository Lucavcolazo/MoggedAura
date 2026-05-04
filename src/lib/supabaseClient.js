import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

let supabase = null;

/**
 * Diagnóstico sin exponer secretos: Vite inyecta estas vars en BUILD.
 * En Vercel, si agregaste variables después del último deploy, hay que redeploy.
 */
export function getSupabaseConfigError() {
  const missing = [];
  if (!supabaseUrl || String(supabaseUrl).trim() === '') missing.push('VITE_SUPABASE_URL');
  if (!supabaseAnonKey || String(supabaseAnonKey).trim() === '') {
    missing.push('VITE_SUPABASE_ANON_KEY o VITE_SUPABASE_PUBLISHABLE_KEY');
  }
  if (missing.length === 0) return null;
  return `Faltan variables de entorno: ${missing.join(', ')}. En Vercel: guardá las vars y ejecutá un nuevo deploy (las variables VITE_* se fijan al compilar). En local: archivo .env en la raíz y reiniciá el dev server.`;
}

export function getSupabaseClient() {
  if (supabase) return supabase;
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return supabase;
}
