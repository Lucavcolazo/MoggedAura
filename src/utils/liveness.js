const LIVENESS_KEY = 'mogged_liveness_verified_at';
const LIVENESS_TTL_MS = 15 * 60 * 1000;

export function markLivenessVerified() {
  try {
    localStorage.setItem(LIVENESS_KEY, String(Date.now()));
  } catch {
    // Ignorar errores de storage en entornos restringidos.
  }
}

export function clearLivenessVerified() {
  try {
    localStorage.removeItem(LIVENESS_KEY);
  } catch {
    // Ignorar errores de storage en entornos restringidos.
  }
}

export function isLivenessVerified() {
  try {
    const raw = localStorage.getItem(LIVENESS_KEY);
    if (!raw) return false;
    const verifiedAt = Number(raw);
    if (!Number.isFinite(verifiedAt)) return false;
    return Date.now() - verifiedAt <= LIVENESS_TTL_MS;
  } catch {
    return false;
  }
}

export function getLivenessTtlMs() {
  return LIVENESS_TTL_MS;
}
