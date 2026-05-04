/**
 * Landmark drawing utilities for canvas overlay
 */

// Key landmark indices to draw
export const KEY_LANDMARKS = {
  // Face oval
  faceOval: [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109],
  // Left eye
  leftEye: [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246],
  // Right eye
  rightEye: [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398],
  // Left eyebrow
  leftBrow: [70, 63, 105, 66, 107, 55, 65, 52, 53, 46],
  // Right eyebrow
  rightBrow: [300, 293, 334, 296, 336, 285, 295, 282, 283, 276],
  // Nose bridge
  noseBridge: [168, 6, 197, 195, 5, 4, 1],
  // Nose bottom
  noseBottom: [48, 115, 220, 45, 4, 275, 440, 344, 278],
  // Lips outer
  lipsOuter: [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185],
  // Jawline
  jawline: [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10],
};

// Simplified key points for the "scanning" effect
export const SCAN_POINTS = [
  // Eyes
  33, 133, 362, 263,
  // Nose
  1, 4, 48, 278,
  // Jaw
  172, 397, 152,
  // Brows
  70, 300,
  // Lips
  61, 291,
  // Forehead
  10,
  // Cheeks
  234, 454,
];

/**
 * Draw landmarks on canvas
 */
export function drawLandmarks(ctx, landmarks, width, height, options = {}) {
  const {
    color = '#00ff88',
    pointSize = 2,
    lineWidth = 1,
    drawConnections = true,
    drawPoints = true,
    glowEffect = true,
    scanPoints = false,
  } = options;

  ctx.clearRect(0, 0, width, height);

  if (!landmarks || landmarks.length === 0) return;

  // Glow effect
  if (glowEffect) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
  }

  const pointsToDraw = scanPoints ? SCAN_POINTS : null;

  // Draw connection lines
  if (drawConnections) {
    ctx.strokeStyle = color + '44'; // Semi-transparent
    ctx.lineWidth = lineWidth;

    // Draw face oval
    drawPath(ctx, landmarks, KEY_LANDMARKS.faceOval, width, height);
    // Draw eyes
    drawPath(ctx, landmarks, KEY_LANDMARKS.leftEye, width, height, true);
    drawPath(ctx, landmarks, KEY_LANDMARKS.rightEye, width, height, true);
    // Draw eyebrows
    drawPath(ctx, landmarks, KEY_LANDMARKS.leftBrow, width, height);
    drawPath(ctx, landmarks, KEY_LANDMARKS.rightBrow, width, height);
    // Draw nose
    drawPath(ctx, landmarks, KEY_LANDMARKS.noseBridge, width, height);
    drawPath(ctx, landmarks, KEY_LANDMARKS.noseBottom, width, height);
    // Draw lips
    drawPath(ctx, landmarks, KEY_LANDMARKS.lipsOuter, width, height, true);
  }

  // Draw points
  if (drawPoints) {
    ctx.fillStyle = color;
    const indices = pointsToDraw || Array.from({ length: landmarks.length }, (_, i) => i);
    
    for (const i of indices) {
      if (i >= landmarks.length) continue;
      const lm = landmarks[i];
      const x = lm.x * width;
      const y = lm.y * height;
      
      ctx.beginPath();
      ctx.arc(x, y, pointSize, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
}

function drawPath(ctx, landmarks, indices, width, height, closePath = false) {
  if (indices.length < 2) return;
  ctx.beginPath();
  const first = landmarks[indices[0]];
  ctx.moveTo(first.x * width, first.y * height);
  for (let i = 1; i < indices.length; i++) {
    const lm = landmarks[indices[i]];
    ctx.lineTo(lm.x * width, lm.y * height);
  }
  if (closePath) ctx.closePath();
  ctx.stroke();
}

/**
 * Draw alignment guide oval
 */
export function drawAlignmentGuide(ctx, width, height, detected = false) {
  const cx = width / 2;
  const cy = height / 2;
  const rx = width * 0.28;
  const ry = height * 0.38;

  ctx.strokeStyle = detected ? '#00ff8866' : '#ffffff33';
  ctx.lineWidth = 2;
  ctx.setLineDash(detected ? [] : [8, 8]);
  
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
  ctx.stroke();
  
  ctx.setLineDash([]);
}
