/**
 * Aura Points System (formerly ELO)
 * Standard chess-style rating for 1v1 mog battles.
 */

const K_FACTOR = 32;
const STARTING_AURA = 1200;

/**
 * Calculate expected score (probability of winning)
 */
function expectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Calculate new Aura Points after a match
 * @param {number} playerAura - Current player Aura Points
 * @param {number} opponentAura - Opponent's Aura Points
 * @param {number} result - 1 = win, 0 = loss, 0.5 = draw
 * @returns {{ newAura: number, change: number }}
 */
export function calculateAura(playerAura, opponentAura, result) {
  const expected = expectedScore(playerAura, opponentAura);
  const change = Math.round(K_FACTOR * (result - expected));
  const newAura = Math.max(100, playerAura + change);
  return { newAura, change };
}

/**
 * Load Aura Points from localStorage
 */
export function loadAura() {
  try {
    // Migrate from old 'mogged_elo' key
    const oldSaved = localStorage.getItem('mogged_elo');
    const saved = localStorage.getItem('mogged_aura');
    if (saved) return parseInt(saved, 10);
    if (oldSaved) {
      localStorage.setItem('mogged_aura', oldSaved);
      return parseInt(oldSaved, 10);
    }
    return STARTING_AURA;
  } catch {
    return STARTING_AURA;
  }
}

/**
 * Save Aura Points to localStorage
 */
export function saveAura(aura) {
  try {
    localStorage.setItem('mogged_aura', String(aura));
  } catch {
    // Storage unavailable
  }
}

/**
 * Load match history from localStorage
 */
export function loadHistory() {
  try {
    const saved = localStorage.getItem('mogged_history');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

/**
 * Save match to history
 */
export function saveMatch(match) {
  try {
    const history = loadHistory();
    history.unshift(match);
    if (history.length > 50) history.length = 50;
    localStorage.setItem('mogged_history', JSON.stringify(history));
  } catch {
    // Storage unavailable
  }
}

/**
 * Get win/loss record
 */
export function getRecord() {
  const history = loadHistory();
  const wins = history.filter(m => m.result === 'win').length;
  const losses = history.filter(m => m.result === 'loss').length;
  return { wins, losses, total: history.length };
}

/**
 * Generate a realistic bot Aura near the player's Aura
 */
export function generateBotAura(playerAura) {
  const variance = 150;
  const offset = (Math.random() - 0.5) * 2 * variance;
  return Math.max(800, Math.round(playerAura + offset));
}

/**
 * Get result message based on score difference
 */
export function getResultMessage(winnerScore, loserScore) {
  const diff = winnerScore - loserScore;
  if (diff < 0.3) return { text: 'CLOSE CALL', emoji: '😰', color: '#ffa94d' };
  if (diff < 0.8) return { text: 'MOGGED', emoji: '😤', color: '#ff6b6b' };
  if (diff < 1.5) return { text: 'BRUTALIZED', emoji: '💀', color: '#ff4444' };
  if (diff < 2.5) return { text: 'ANNIHILATED', emoji: '☠️', color: '#cc0000' };
  return { text: 'SENT TO THE SHADOW REALM', emoji: '🕳️', color: '#8b0000' };
}

export { STARTING_AURA };
