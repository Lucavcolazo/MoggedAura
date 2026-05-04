import { useState, useRef, useCallback, useEffect } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

/**
 * Hook to initialize and use MediaPipe FaceLandmarker
 */
export function useFaceLandmarker() {
  const landmarkerRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);

  const initialize = useCallback(async () => {
    if (landmarkerRef.current) {
      setIsReady(true);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU',
        },
        outputFaceBlendshapes: true,
        runningMode: 'VIDEO',
        numFaces: 1,
      });

      landmarkerRef.current = faceLandmarker;
      setIsReady(true);
    } catch (err) {
      console.error('FaceLandmarker init error:', err);
      setError('Failed to load face detection model. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Detect landmarks from a video frame
   * @param {HTMLVideoElement} video 
   * @returns {{ landmarks, blendshapes } | null}
   */
  const detect = useCallback((video) => {
    if (!landmarkerRef.current || !video || video.readyState < 2) {
      return null;
    }

    try {
      const result = landmarkerRef.current.detectForVideo(video, performance.now());
      
      if (result.faceLandmarks && result.faceLandmarks.length > 0) {
        return {
          landmarks: result.faceLandmarks[0],
          blendshapes: result.faceBlendshapes?.[0]?.categories || [],
        };
      }
      return null;
    } catch (err) {
      // Silently fail on detection errors (common during video transitions)
      return null;
    }
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
        landmarkerRef.current = null;
      }
    };
  }, []);

  return {
    initialize,
    detect,
    isLoading,
    isReady,
    error,
  };
}
