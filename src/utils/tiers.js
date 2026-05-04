/**
 * Tier / Rank System
 * Maps PSL scores to competitive tiers.
 */

export const TIERS = [
  { 
    name: "SUB5", 
    label: "Sub 5",
    min: 1.0, 
    max: 4.0, 
    color: "#666666", 
    emoji: "💀",
    description: "Below average",
    bgGradient: "linear-gradient(135deg, #333, #555)",
  },
  { 
    name: "HTN", 
    label: "Hunting",
    min: 4.0, 
    max: 5.5, 
    color: "#ff6b6b", 
    emoji: "🏹",
    description: "Needs improvement",
    bgGradient: "linear-gradient(135deg, #ff6b6b33, #ff6b6b11)",
  },
  { 
    name: "MTN", 
    label: "Mountain",
    min: 5.5, 
    max: 6.5, 
    color: "#ffa94d", 
    emoji: "⛰️",
    description: "Average tier",
    bgGradient: "linear-gradient(135deg, #ffa94d33, #ffa94d11)",
  },
  { 
    name: "CHADLITE", 
    label: "Chadlite",
    min: 6.5, 
    max: 7.5, 
    color: "#69db7c", 
    emoji: "😎",
    description: "Above average",
    bgGradient: "linear-gradient(135deg, #69db7c33, #69db7c11)",
  },
  { 
    name: "CHAD", 
    label: "Chad",
    min: 7.5, 
    max: 8.5, 
    color: "#4dabf7", 
    emoji: "👑",
    description: "Top tier",
    bgGradient: "linear-gradient(135deg, #4dabf733, #4dabf711)",
  },
  { 
    name: "GIGACHAD", 
    label: "Gigachad",
    min: 8.5, 
    max: 10.1, 
    color: "#da77f2", 
    emoji: "🗿",
    description: "Legendary",
    bgGradient: "linear-gradient(135deg, #da77f233, #da77f211)",
  },
];

/**
 * Get tier from PSL score
 */
export function getTier(score) {
  for (const tier of TIERS) {
    if (score >= tier.min && score < tier.max) return tier;
  }
  return TIERS[TIERS.length - 1];
}

/**
 * Get tier by name
 */
export function getTierByName(name) {
  return TIERS.find(t => t.name === name) || TIERS[0];
}
