/**
 * PSL Scoring Algorithm
 * Calculates facial attractiveness score from MediaPipe FaceMesh 468 landmarks.
 * All processing is local — no data leaves the browser.
 */

// Helper: Euclidean distance between two 3D landmarks
function dist(a, b) {
  return Math.sqrt(
    (a.x - b.x) ** 2 + 
    (a.y - b.y) ** 2 + 
    (a.z - b.z) ** 2
  );
}

// Helper: 2D distance (ignoring depth)
function dist2D(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// Helper: Calculate angle between three points (in degrees)
function angleBetween(a, b, c) {
  const ba = { x: a.x - b.x, y: a.y - b.y };
  const bc = { x: c.x - b.x, y: c.y - b.y };
  const dot = ba.x * bc.x + ba.y * bc.y;
  const magBA = Math.sqrt(ba.x ** 2 + ba.y ** 2);
  const magBC = Math.sqrt(bc.x ** 2 + bc.y ** 2);
  const cosAngle = Math.max(-1, Math.min(1, dot / (magBA * magBC)));
  return Math.acos(cosAngle) * (180 / Math.PI);
}

// Helper: Clamp value between 0 and 1
function clamp01(val) {
  return Math.max(0, Math.min(1, val));
}

/**
 * 1. FACIAL SYMMETRY (weight: 25%)
 * Compares bilateral landmark pairs across the face midline.
 */
function calculateSymmetry(lm) {
  // Bilateral landmark pairs: [left, right]
  const pairs = [
    [33, 263],   // Eye outer corners
    [133, 362],  // Eye inner corners
    [70, 300],   // Eyebrow outer
    [105, 334],  // Eyebrow inner
    [234, 454],  // Ear points (cheek)
    [172, 397],  // Jaw angle points
    [58, 288],   // Lower jaw
    [132, 361],  // Mid cheek
    [93, 323],   // Upper cheek
    [50, 280],   // Nose side
  ];

  // Nose tip as midline reference
  const midline = lm[1]; // Nose tip
  
  let totalDiff = 0;
  let count = 0;

  for (const [li, ri] of pairs) {
    const leftDist = dist2D(lm[li], midline);
    const rightDist = dist2D(lm[ri], midline);
    const avg = (leftDist + rightDist) / 2;
    if (avg > 0.001) {
      const ratio = Math.abs(leftDist - rightDist) / avg;
      totalDiff += ratio;
      count++;
    }
  }

  const avgDiff = count > 0 ? totalDiff / count : 0;
  // Lower difference = higher symmetry score
  // Typical range: 0 (perfect) to 0.3+ (very asymmetric)
  return clamp01(1 - avgDiff * 3);
}

/**
 * 2. JAWLINE SCORE (weight: 20%)
 * Evaluates jawline prominence via gonial angle and jaw-to-face width ratio.
 */
function calculateJawline(lm) {
  // Gonial angle: jaw angle formed at landmarks
  // Left jaw: 172 (gonion), 152 (chin), 234 (temporal)
  const gonialAngleLeft = angleBetween(lm[234], lm[172], lm[152]);
  // Right jaw
  const gonialAngleRight = angleBetween(lm[454], lm[397], lm[152]);
  const gonialAngle = (gonialAngleLeft + gonialAngleRight) / 2;

  // Ideal gonial angle: 115-128 degrees for men
  // Score based on proximity to ideal range
  let gonialScore;
  if (gonialAngle >= 115 && gonialAngle <= 128) {
    gonialScore = 1.0;
  } else if (gonialAngle < 115) {
    gonialScore = clamp01(1 - (115 - gonialAngle) / 30);
  } else {
    gonialScore = clamp01(1 - (gonialAngle - 128) / 30);
  }

  // Jaw width to cheekbone width ratio
  const jawWidth = dist2D(lm[172], lm[397]);
  const cheekWidth = dist2D(lm[234], lm[454]);
  const jawRatio = cheekWidth > 0 ? jawWidth / cheekWidth : 0;
  // Ideal: 0.75-0.85 (prominent but not wider than cheekbones)
  let ratioScore;
  if (jawRatio >= 0.75 && jawRatio <= 0.85) {
    ratioScore = 1.0;
  } else {
    ratioScore = clamp01(1 - Math.abs(jawRatio - 0.8) * 3);
  }

  return gonialScore * 0.6 + ratioScore * 0.4;
}

/**
 * 3. EYE METRICS (weight: 20%)
 * Canthal tilt (hunter vs prey eyes) + eye spacing ratio.
 */
function calculateEyeMetrics(lm) {
  // Canthal tilt: difference in Y between outer and inner eye corners
  // Left eye: inner=133, outer=33
  const leftTilt = lm[33].y - lm[133].y; // Negative = positive tilt (hunter eyes)
  // Right eye: inner=362, outer=263
  const rightTilt = lm[263].y - lm[362].y;
  const avgTilt = (leftTilt + rightTilt) / 2;

  // Positive canthal tilt (outer corner higher) = hunter eyes = good
  // Negative = prey eyes = lower score
  // Tilt is in normalized coordinates, typical range: -0.02 to 0.02
  let tiltScore;
  if (avgTilt <= -0.005) {
    // Positive tilt (remember Y is inverted in screen coords)
    tiltScore = clamp01(0.7 + Math.abs(avgTilt) * 15);
  } else if (avgTilt >= 0.005) {
    // Negative tilt = prey eyes
    tiltScore = clamp01(0.5 - avgTilt * 10);
  } else {
    tiltScore = 0.65; // Neutral
  }

  // Eye spacing: five-eye rule
  // Inter-ocular distance should be roughly 1 eye-width
  const leftEyeWidth = dist2D(lm[33], lm[133]);
  const rightEyeWidth = dist2D(lm[263], lm[362]);
  const avgEyeWidth = (leftEyeWidth + rightEyeWidth) / 2;
  const interOcular = dist2D(lm[133], lm[362]);
  const spacingRatio = avgEyeWidth > 0 ? interOcular / avgEyeWidth : 1;
  
  // Ideal: ~1.0 (one eye-width between eyes)
  const spacingScore = clamp01(1 - Math.abs(spacingRatio - 1.0) * 2);

  // FWHR (face width to height ratio of upper face)
  const faceWidth = dist2D(lm[234], lm[454]);
  const upperFaceHeight = dist2D(lm[10], lm[152]) * 0.5; // approx upper half
  const fwhr = upperFaceHeight > 0 ? faceWidth / upperFaceHeight : 1;
  const fwhrScore = clamp01(1 - Math.abs(fwhr - 1.9) * 0.5); // Ideal ~1.9

  return tiltScore * 0.45 + spacingScore * 0.3 + fwhrScore * 0.25;
}

/**
 * 4. NOSE PROPORTION (weight: 15%)
 * Nose width relative to face width.
 */
function calculateNoseRatio(lm) {
  // Nose width: nostril edges
  const noseWidth = dist2D(lm[48], lm[278]);
  // Face width at cheekbones
  const faceWidth = dist2D(lm[234], lm[454]);
  
  const ratio = faceWidth > 0 ? noseWidth / faceWidth : 0.25;
  // Ideal: ~0.22-0.28
  if (ratio >= 0.22 && ratio <= 0.28) return 1.0;
  return clamp01(1 - Math.abs(ratio - 0.25) * 8);
}

/**
 * 5. FACIAL THIRDS (weight: 10%)
 * Upper, middle, lower face should be roughly equal.
 */
function calculateFacialThirds(lm) {
  // Upper: forehead (10) to eyebrow (107)
  const upper = dist2D(lm[10], lm[107]);
  // Middle: eyebrow (107) to nose base (2)
  const middle = dist2D(lm[107], lm[2]);
  // Lower: nose base (2) to chin (152)
  const lower = dist2D(lm[2], lm[152]);
  
  const total = upper + middle + lower;
  if (total < 0.001) return 0.5;

  const upperRatio = upper / total;
  const middleRatio = middle / total;
  const lowerRatio = lower / total;

  // Ideal: each ~0.333
  const upperDev = Math.abs(upperRatio - 0.333);
  const middleDev = Math.abs(middleRatio - 0.333);
  const lowerDev = Math.abs(lowerRatio - 0.333);

  const avgDev = (upperDev + middleDev + lowerDev) / 3;
  return clamp01(1 - avgDev * 8);
}

/**
 * 6. CHEEKBONE PROMINENCE (weight: 10%)
 * Cheekbone width relative to jaw and forehead.
 */
function calculateCheekbones(lm) {
  const cheekWidth = dist2D(lm[234], lm[454]);
  const jawWidth = dist2D(lm[172], lm[397]);
  const foreheadWidth = dist2D(lm[21], lm[251]);

  // Ideal: cheekbones wider than both jaw and forehead
  let score = 0.5;
  if (cheekWidth > jawWidth && cheekWidth > foreheadWidth) {
    score = 0.85;
  }
  if (jawWidth > 0) {
    const ratio = cheekWidth / jawWidth;
    // Ideal: 1.1-1.3
    if (ratio >= 1.1 && ratio <= 1.3) score = Math.max(score, 0.9);
  }
  return clamp01(score);
}

// ==================== FEATURE LABELS ==================== 

const DOM_LABELS = {
  symmetry: "Perfect Symmetry",
  jawlineScore: "Chad Jawline",
  eyeScore: "Hunter Eyes",
  noseScore: "Ideal Proportions",
  thirdsScore: "Golden Ratio",
  cheekboneScore: "High Cheekbones",
};

const FLAW_LABELS = {
  symmetry: "Asymmetry",
  jawlineScore: "Weak Jawline",
  eyeScore: "Prey Eyes",
  noseScore: "Nose Proportion",
  thirdsScore: "Uneven Thirds",
  cheekboneScore: "Flat Cheekbones",
};

function getDominantFeature(metrics) {
  let best = null;
  let bestVal = -1;
  for (const [key, val] of Object.entries(metrics)) {
    if (val > bestVal) {
      bestVal = val;
      best = key;
    }
  }
  return { key: best, label: DOM_LABELS[best] || best, value: bestVal };
}

function getWeakestFeature(metrics) {
  let worst = null;
  let worstVal = 2;
  for (const [key, val] of Object.entries(metrics)) {
    if (val < worstVal) {
      worstVal = val;
      worst = key;
    }
  }
  return { key: worst, label: FLAW_LABELS[worst] || worst, value: worstVal };
}

/**
 * MAIN: Calculate full PSL score from face landmarks
 * @param {Array} landmarks - Array of 468 {x, y, z} normalized landmarks
 * @returns {Object} { overall, metrics, dominant, flaw, tier }
 */
export function calculatePSLScore(landmarks) {
  if (!landmarks || landmarks.length < 468) {
    return null;
  }

  const metrics = {
    symmetry: calculateSymmetry(landmarks),
    jawlineScore: calculateJawline(landmarks),
    eyeScore: calculateEyeMetrics(landmarks),
    noseScore: calculateNoseRatio(landmarks),
    thirdsScore: calculateFacialThirds(landmarks),
    cheekboneScore: calculateCheekbones(landmarks),
  };

  const weighted =
    metrics.symmetry * 0.25 +
    metrics.jawlineScore * 0.20 +
    metrics.eyeScore * 0.20 +
    metrics.noseScore * 0.15 +
    metrics.thirdsScore * 0.10 +
    metrics.cheekboneScore * 0.10;

  // Map 0-1 to 1-10 with slight curve for more realistic distribution
  const curved = Math.pow(weighted, 0.85); // Slight boost
  const overall = parseFloat((curved * 9 + 1).toFixed(1));

  return {
    overall: Math.min(10, Math.max(1, overall)),
    metrics,
    dominant: getDominantFeature(metrics),
    flaw: getWeakestFeature(metrics),
  };
}

/**
 * Generate a fake/bot PSL score for simulated opponents
 */
export function generateBotScore() {
  // Generate realistic-looking scores
  const base = 4.5 + Math.random() * 4; // 4.5 - 8.5 range
  const metrics = {
    symmetry: 0.4 + Math.random() * 0.5,
    jawlineScore: 0.3 + Math.random() * 0.6,
    eyeScore: 0.3 + Math.random() * 0.6,
    noseScore: 0.4 + Math.random() * 0.5,
    thirdsScore: 0.4 + Math.random() * 0.5,
    cheekboneScore: 0.3 + Math.random() * 0.6,
  };

  return {
    overall: parseFloat(base.toFixed(1)),
    metrics,
    dominant: getDominantFeature(metrics),
    flaw: getWeakestFeature(metrics),
  };
}
