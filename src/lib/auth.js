import { getSupabaseClient, getSupabaseConfigError } from './supabaseClient';

export async function signUpWithEmail(email, password) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error(getSupabaseConfigError() || 'Supabase no esta configurado.');
  }
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signInWithEmail(email, password) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error(getSupabaseConfigError() || 'Supabase no esta configurado.');
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOutUser() {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  await supabase.auth.signOut();
}
