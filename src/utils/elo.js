/**
 * ELO Rating System
 * Standard chess-style ELO for 1v1 mog battles.
 */

const K_FACTOR = 32;
const STARTING_ELO = 1200;

/**
 * Calculate expected score (probability of winning)
 */
function expectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Calculate new ELO after a match
 * @param {number} playerElo - Current player ELO
 * @param {number} opponentElo - Opponent's ELO
 * @param {number} result - 1 = win, 0 = loss, 0.5 = draw
 * @returns {{ newElo: number, change: number }}
 */
export function calculateElo(playerElo, opponentElo, result) {
  const expected = expectedScore(playerElo, opponentElo);
  const change = Math.round(K_FACTOR * (result - expected));
  const newElo = Math.max(100, playerElo + change); // Floor at 100
  return { newElo, change };
}

/**
 * Load ELO from localStorage
 */
export function loadElo() {
  try {
    const saved = localStorage.getItem('mogged_elo');
    return saved ? parseInt(saved, 10) : STARTING_ELO;
  } catch {
    return STARTING_ELO;
  }
}

/**
 * Save ELO to localStorage
 */
export function saveElo(elo) {
  try {
    localStorage.setItem('mogged_elo', String(elo));
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
    history.unshift(match); // Newest first
    if (history.length > 50) history.length = 50; // Keep last 50
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
 * Generate a realistic bot ELO near the player's ELO
 */
export function generateBotElo(playerElo) {
  const variance = 150;
  const offset = (Math.random() - 0.5) * 2 * variance;
  return Math.max(800, Math.round(playerElo + offset));
}

export { STARTING_ELO };
