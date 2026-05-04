import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCamera } from '../hooks/useCamera';
import { useFaceLandmarker } from '../hooks/useFaceLandmarker';
import { drawLandmarks, drawAlignmentGuide } from '../utils/landmarks';
import { markLivenessVerified } from '../utils/liveness';
import '../styles/camera.css';

const STEPS = [
  { key: 'align', label: 'Align', instruction: '👤 Center your face in the frame' },
  { key: 'blink', label: 'Blink', instruction: '👁️ Blink naturally' },
  { key: 'turn', label: 'Turn', instruction: '↔️ Turn your head slightly' },
  { key: 'done', label: 'Done', instruction: '✅ Verified!' },
];

export default function CameraCheckPage() {
  const navigate = useNavigate();
  const { videoRef, isActive, isLoading: cameraLoading, error: cameraError, startCamera, stopCamera } = useCamera();
  const { initialize, detect, isLoading: modelLoading, isReady, error: modelError } = useFaceLandmarker();
  
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  
  const [currentStep, setCurrentStep] = useState(0);
  const [stepProgress, setStepProgress] = useState([0, 0, 0, 0]);
  const [hasStarted, setHasStarted] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);

  // Counters for liveness detection
  const blinkCountRef = useRef(0);
  const turnCountRef = useRef(0);
  const alignCountRef = useRef(0);

  const handleStart = async () => {
    setHasStarted(true);
    await Promise.all([startCamera(), initialize()]);
  };

  // Detection loop
  const runDetection = useCallback(() => {
    if (!videoRef.current || !isReady || !isActive) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const result = detect(video);
    
    if (result) {
      setFaceDetected(true);
      const { landmarks, blendshapes } = result;
      
      // Draw landmarks
      drawLandmarks(ctx, landmarks, canvas.width, canvas.height, {
        color: '#00ff88',
        pointSize: 1.5,
        lineWidth: 0.5,
        scanPoints: true,
      });
      drawAlignmentGuide(ctx, canvas.width, canvas.height, true);

      // Step logic
      if (currentStep === 0) {
        // ALIGN: Check if nose is near center
        const nose = landmarks[1];
        const centerX = Math.abs(nose.x - 0.5);
        const centerY = Math.abs(nose.y - 0.5);
        if (centerX < 0.15 && centerY < 0.2) {
          alignCountRef.current++;
          setStepProgress(p => { const n = [...p]; n[0] = Math.min(100, (alignCountRef.current / 15) * 100); return n; });
          if (alignCountRef.current > 15) {
            setCurrentStep(1);
            setStepProgress(p => { const n = [...p]; n[0] = 100; return n; });
          }
        }
      } else if (currentStep === 1) {
        // BLINK: Check blendshapes
        const leftBlink = blendshapes.find(b => b.categoryName === 'eyeBlinkLeft');
        const rightBlink = blendshapes.find(b => b.categoryName === 'eyeBlinkRight');
        if (leftBlink && rightBlink && leftBlink.score > 0.4 && rightBlink.score > 0.4) {
          blinkCountRef.current++;
          setStepProgress(p => { const n = [...p]; n[1] = Math.min(100, (blinkCountRef.current / 3) * 100); return n; });
          if (blinkCountRef.current >= 3) {
            setCurrentStep(2);
            setStepProgress(p => { const n = [...p]; n[1] = 100; return n; });
          }
        }
      } else if (currentStep === 2) {
        // TURN: Check head rotation via ear landmarks
        const leftEar = landmarks[234];
        const rightEar = landmarks[454];
        const diff = Math.abs(leftEar.x - rightEar.x);
        // When turning, one ear gets closer to center
        if (diff < 0.25) {
          turnCountRef.current++;
          setStepProgress(p => { const n = [...p]; n[2] = Math.min(100, (turnCountRef.current / 8) * 100); return n; });
          if (turnCountRef.current >= 8) {
            setCurrentStep(3);
            setStepProgress(p => { const n = [...p]; n[2] = 100; n[3] = 100; return n; });
          }
        }
      }
    } else {
      setFaceDetected(false);
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawAlignmentGuide(ctx, canvas.width, canvas.height, false);
      }
    }

    animFrameRef.current = requestAnimationFrame(runDetection);
  }, [isReady, isActive, detect, videoRef, currentStep]);

  // Start detection loop when camera + model ready
  useEffect(() => {
    if (isActive && isReady) {
      animFrameRef.current = requestAnimationFrame(runDetection);
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isActive, isReady, runDetection]);

  // Navigate to dashboard when done
  useEffect(() => {
    if (currentStep === 3) {
      const timer = setTimeout(() => {
        markLivenessVerified();
        stopCamera();
        navigate('/dashboard');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [currentStep, navigate, stopCamera]);

  const error = cameraError || modelError;
  const loading = cameraLoading || modelLoading;

  return (
    <div className="camera-page">
      <Link to="/" className="camera-back">← Back</Link>
      
      <div className="camera-container">
        <div className="camera-header">
          <div className="camera-header__badge">🔒 SECURE SESSION</div>
          <h1 className="camera-header__title">Camera Access Check</h1>
          <p className="camera-header__subtitle">Short-lived session challenge</p>
        </div>

        <div className="camera-viewport">
          <video ref={videoRef} playsInline muted />
          <canvas ref={canvasRef} />
          
          {!hasStarted && (
            <div className="camera-viewport__loading">
              <div style={{ fontSize: '3rem' }}>📷</div>
              <button className="camera-start-btn" onClick={handleStart} id="start-camera">
                Enable Camera
              </button>
            </div>
          )}

          {hasStarted && loading && (
            <div className="camera-viewport__loading">
              <div className="camera-viewport__spinner" />
              <span className="camera-viewport__loading-text">
                {modelLoading ? 'Loading AI model...' : 'Starting camera...'}
              </span>
            </div>
          )}

          {error && (
            <div className="camera-viewport__loading">
              <div className="camera-error">
                <div className="camera-error__icon">⚠️</div>
                <div className="camera-error__title">Access Error</div>
                <div className="camera-error__desc">{error}</div>
                <button className="camera-start-btn" onClick={handleStart}>Try Again</button>
              </div>
            </div>
          )}

          {isActive && isReady && currentStep < 3 && (
            <>
              <div className="camera-viewport__scanline" />
              <div className={`camera-instruction camera-instruction--active`}>
                {STEPS[currentStep].instruction}
              </div>
            </>
          )}

          {currentStep === 3 && (
            <div className={`camera-instruction camera-instruction--done`}>
              ✅ Liveness verified — entering arena...
            </div>
          )}
        </div>

        {/* Progress steps */}
        <div className="camera-steps">
          {STEPS.map((step, i) => (
            <div className="camera-step" key={step.key}>
              <div className="camera-step__bar">
                <div className="camera-step__fill" style={{ width: `${stepProgress[i]}%` }} />
              </div>
              <span className={`camera-step__label ${
                i === currentStep ? 'camera-step__label--active' : 
                i < currentStep ? 'camera-step__label--done' : ''
              }`}>
                {step.label}
              </span>
            </div>
          ))}
        </div>

        <div className="camera-privacy">
          <span className="camera-privacy__icon">🔒</span>
          Facial landmarks are processed locally on your device. Never uploaded or stored.
        </div>
      </div>
    </div>
  );
}
