import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useCamera } from '../hooks/useCamera';
import { useFaceLandmarker } from '../hooks/useFaceLandmarker';
import { usePSLScore } from '../hooks/usePSLScore';
import { drawLandmarks } from '../utils/landmarks';
import { getTier } from '../utils/tiers';
import '../styles/battle.css';

export default function LabPage() {
  const { videoRef, isActive, startCamera, stopCamera } = useCamera();
  const { initialize, detect, isReady, isLoading } = useFaceLandmarker();
  const { score, processFrame, startScanning, reset } = usePSLScore();
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const [started, setStarted] = useState(false);

  const handleStart = async () => {
    setStarted(true);
    await Promise.all([startCamera(), initialize()]);
    startScanning();
  };

  useEffect(() => {
    return () => {
      stopCamera();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const runDetection = useCallback(() => {
    if (!videoRef.current || !isReady || !isActive) {
      animFrameRef.current = requestAnimationFrame(runDetection);
      return;
    }
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!canvas) { animFrameRef.current = requestAnimationFrame(runDetection); return; }
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const result = detect(video);
    if (result) {
      drawLandmarks(ctx, result.landmarks, canvas.width, canvas.height, {
        color: '#00ff88', pointSize: 1.5, lineWidth: 0.5, glowEffect: true,
      });
      processFrame(result.landmarks);
    }
    animFrameRef.current = requestAnimationFrame(runDetection);
  }, [isReady, isActive, detect, videoRef, processFrame]);

  useEffect(() => {
    if (isActive && isReady) {
      animFrameRef.current = requestAnimationFrame(runDetection);
    }
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [isActive, isReady, runDetection]);

  // Save score
  useEffect(() => {
    if (score) {
      localStorage.setItem('mogged_last_score', String(score.overall));
    }
  }, [score]);

  const tier = score ? getTier(score.overall) : null;

  return (
    <div className="battle-page">
      <Link to="/dashboard" className="battle-back">← Back</Link>
      <div className="battle-content" style={{ justifyContent: 'center' }}>
        <div className="player-panel" style={{ maxHeight: '80vh', flex: 'none' }}>
          <div className="player-panel__video-wrap" style={{ minHeight: '300px' }}>
            <div className="player-panel__label" style={{ color: '#00d4ff' }}>🧪 THE LAB — SOLO SCAN</div>
            <video ref={videoRef} playsInline muted />
            <canvas ref={canvasRef} />
            {!started && (
              <div className="bot-avatar">
                <div className="bot-avatar__icon">🧪</div>
                <button className="btn-cta" onClick={handleStart} style={{ marginTop: '16px' }}>
                  START SCAN
                </button>
              </div>
            )}
            {started && (isLoading || !isReady) && (
              <div className="bot-avatar">
                <div className="battle-state__spinner" />
                <div className="bot-avatar__text">Loading AI model...</div>
              </div>
            )}
            {started && isActive && isReady && (
              <div className="scanning-overlay">
                <div className="scanning-overlay__line" />
              </div>
            )}
          </div>
          <div className="player-panel__info">
            <div className="player-info__left">
              <div className="player-info__score" style={{ color: tier?.color || '#fff' }}>
                {score ? score.overall.toFixed(1) : '—'}
              </div>
              <div className="player-info__details">
                <span className="player-info__name">
                  {score ? 'PSL Score' : 'Scanning...'}
                </span>
                <span className="player-info__elo">
                  {tier ? `${tier.emoji} ${tier.label}` : 'Waiting for face'}
                </span>
              </div>
            </div>
            <div className="player-info__right">
              {tier && (
                <span className="tier-badge" style={{
                  background: tier.color + '22', color: tier.color,
                  border: `1px solid ${tier.color}44`
                }}>
                  {tier.emoji} {tier.name}
                </span>
              )}
              {score?.dominant && (
                <span className="player-info__dom">
                  <span className="player-info__tag">DOM </span>
                  <span className="player-info__dom-label">{score.dominant.label}</span>
                </span>
              )}
              {score?.flaw && (
                <span className="player-info__dom">
                  <span className="player-info__tag">FLAW </span>
                  <span className="player-info__flaw-label">{score.flaw.label}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Metrics breakdown */}
        {score && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px',
            padding: '16px', background: 'rgba(17,17,17,0.6)', borderRadius: '12px',
            border: '1px solid var(--border-subtle)', animation: 'slide-up 0.4s ease',
          }}>
            {Object.entries(score.metrics).map(([key, value]) => {
              const labels = {
                symmetry: 'Symmetry', jawlineScore: 'Jawline', eyeScore: 'Eye Area',
                noseScore: 'Nose', thirdsScore: 'Facial Thirds', cheekboneScore: 'Cheekbones',
              };
              const pct = Math.round(value * 100);
              return (
                <div key={key} style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: 'var(--fs-xs)', color: 'var(--text-dim)',
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                    marginBottom: '4px', fontFamily: 'var(--font-heading)',
                  }}>
                    {labels[key] || key}
                  </div>
                  <div style={{
                    height: '3px', background: 'var(--bg-elevated)',
                    borderRadius: '4px', overflow: 'hidden', marginBottom: '4px',
                  }}>
                    <div style={{
                      width: `${pct}%`, height: '100%',
                      background: pct > 70 ? 'var(--accent-green)' : pct > 40 ? 'var(--accent-gold)' : 'var(--accent-red)',
                      borderRadius: '4px', transition: 'width 0.5s ease',
                    }} />
                  </div>
                  <div style={{
                    fontSize: 'var(--fs-sm)', fontWeight: 700,
                    fontFamily: 'var(--font-heading)',
                    color: pct > 70 ? 'var(--accent-green)' : pct > 40 ? '#ffa94d' : 'var(--accent-red)',
                  }}>
                    {pct}%
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
