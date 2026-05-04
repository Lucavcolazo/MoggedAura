import { getSupabaseClient } from './supabaseClient';
import { STARTING_AURA } from '../utils/aura';

function fallbackUsername(email) {
  const left = (email || 'player').split('@')[0];
  return left.slice(0, 20) || 'player';
}

function normalizeUsername(value, fallback) {
  const base = (value || fallback || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  return base.slice(0, 20) || fallbackUsername(fallback || 'player@example.com');
}

export async function ensureProfile(user, preferredUsername) {
  const supabase = getSupabaseClient();
  if (!supabase || !user) return null;

  const { data: existing, error: readError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (readError) throw readError;

  if (existing) {
    const patch = { email: user.email };
    if (preferredUsername) {
      patch.username = normalizeUsername(preferredUsername, user.email);
    }
    const { data, error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', user.id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  const username = normalizeUsername(preferredUsername, user.email);
  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id: user.id,
      email: user.email,
      username,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function loadMyProfile(userId) {
  const supabase = getSupabaseClient();
  if (!supabase || !userId) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateProfileAfterMatch({
  userId,
  newAura,
  result,
  playerScore,
}) {
  const supabase = getSupabaseClient();
  if (!supabase || !userId) return;

  const { data: current, error: currentError } = await supabase
    .from('profiles')
    .select('aura_points,wins,losses,best_psl')
    .eq('id', userId)
    .single();

  if (currentError) throw currentError;

  const wins = Number(current?.wins || 0) + (result === 'win' ? 1 : 0);
  const losses = Number(current?.losses || 0) + (result === 'loss' ? 1 : 0);
  const bestPsl = Math.max(Number(current?.best_psl || 0), Number(playerScore || 0));

  const { error } = await supabase
    .from('profiles')
    .update({
      aura_points: Number(newAura || STARTING_AURA),
      wins,
      losses,
      best_psl: bestPsl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) throw error;
}

export async function fetchTopScoreboard(limit = 20) {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('id,username,aura_points,best_psl,wins,losses')
    .order('aura_points', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function updateMyUsername(userId, username) {
  const supabase = getSupabaseClient();
  if (!supabase || !userId) return null;
  const normalized = normalizeUsername(username, 'player@example.com');
  const { data, error } = await supabase
    .from('profiles')
    .update({
      username: normalized,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select('*')
    .single();
  if (error) {
    if (error.code === '23505' || String(error.message || '').toLowerCase().includes('duplicate')) {
      throw new Error('Ese nombre de usuario ya existe en la base de datos. Elige otro.');
    }
    throw error;
  }
  return data;
}
