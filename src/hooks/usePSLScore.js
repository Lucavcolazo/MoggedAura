import { useState, useRef, useCallback } from 'react';
import { calculatePSLScore } from '../utils/scoring';

/**
 * Hook to compute PSL score from landmarks with smoothing
 */
export function usePSLScore() {
  const [score, setScore] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const scoresBuffer = useRef([]);
  const frameCount = useRef(0);

  /**
   * Process a single frame of landmarks
   * Smooths results over multiple frames for stability
   */
  const processFrame = useCallback((landmarks) => {
    if (!landmarks) return;

    const result = calculatePSLScore(landmarks);
    if (!result) return;

    scoresBuffer.current.push(result);
    frameCount.current++;

    // Update displayed score every 5 frames for smoothing
    if (frameCount.current % 5 === 0 && scoresBuffer.current.length > 0) {
      const buffer = scoresBuffer.current;
      
      // Average the overall scores
      const avgOverall = buffer.reduce((sum, s) => sum + s.overall, 0) / buffer.length;
      
      // Average each metric
      const avgMetrics = {};
      const metricKeys = Object.keys(buffer[0].metrics);
      for (const key of metricKeys) {
        avgMetrics[key] = buffer.reduce((sum, s) => sum + s.metrics[key], 0) / buffer.length;
      }

      // Use the latest frame's dominant/flaw (they're categorical, not averageable)
      const latest = buffer[buffer.length - 1];

      setScore({
        overall: parseFloat(avgOverall.toFixed(1)),
        metrics: avgMetrics,
        dominant: latest.dominant,
        flaw: latest.flaw,
      });

      // Keep only last 10 scores for running average
      if (scoresBuffer.current.length > 10) {
        scoresBuffer.current = scoresBuffer.current.slice(-10);
      }
    }
  }, []);

  const startScanning = useCallback(() => {
    setIsScanning(true);
    scoresBuffer.current = [];
    frameCount.current = 0;
    setScore(null);
  }, []);

  const stopScanning = useCallback(() => {
    setIsScanning(false);
  }, []);

  const reset = useCallback(() => {
    setScore(null);
    scoresBuffer.current = [];
    frameCount.current = 0;
    setIsScanning(false);
  }, []);

  return {
    score,
    isScanning,
    processFrame,
    startScanning,
    stopScanning,
    reset,
  };
}
