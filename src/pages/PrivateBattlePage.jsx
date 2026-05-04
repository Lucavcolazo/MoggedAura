import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCamera } from '../hooks/useCamera';
import { useFaceLandmarker } from '../hooks/useFaceLandmarker';
import { usePSLScore } from '../hooks/usePSLScore';
import { usePeerConnection } from '../hooks/usePeerConnection';
import { drawLandmarks } from '../utils/landmarks';
import { getTier } from '../utils/tiers';
import { calculateAura, loadAura, saveAura, saveMatch, getResultMessage } from '../utils/aura';
import { isLivenessVerified } from '../utils/liveness';
import '../styles/battle.css';

const SCAN_DURATION = 10; // seconds
const OVERTIME_DURATION = 5; // seconds
const READY_COUNTDOWN = 5; // seconds before battle starts after both ready

function FireExplosion() {
  const embers = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    left: `${10 + Math.random() * 80}%`,
    delay: `${Math.random() * 0.8}s`,
    duration: `${1 + Math.random() * 1}s`,
    emberX: `${(Math.random() - 0.5) * 60}px`,
  }));

  return (
    <div className="fire-explosion-container">
      <div className="fire-explosion__glow" />
      <div className="fire-explosion__ring" />
      <div className="fire-explosion__embers">
        {embers.map(e => (
          <div
            key={e.id}
            className="fire-ember"
            style={{
              left: e.left,
              animationDelay: e.delay,
              animationDuration: e.duration,
              '--ember-x': e.emberX,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Helper: compute object-fit:cover transform for canvas alignment
 * Returns { sx, sy, sw, sh } describing which part of the video is visible
 */
function getCoverTransform(video, container) {
  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 480;
  const cw = container.clientWidth;
  const ch = container.clientHeight;
  if (!cw || !ch) return { scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0, drawW: vw, drawH: vh };

  const videoRatio = vw / vh;
  const containerRatio = cw / ch;

  let drawW, drawH, offsetX, offsetY;

  if (containerRatio > videoRatio) {
    // Container is wider than video — video is cropped top/bottom
    drawW = vw;
    drawH = vw / containerRatio;
    offsetX = 0;
    offsetY = (vh - drawH) / 2;
  } else {
    // Container is taller than video — video is cropped left/right
    drawH = vh;
    drawW = vh * containerRatio;
    offsetX = (vw - drawW) / 2;
    offsetY = 0;
  }

  return {
    scaleX: cw / drawW,
    scaleY: ch / drawH,
    offsetX,
    offsetY,
    drawW,
    drawH,
    containerW: cw,
    containerH: ch,
  };
}

export default function PrivateBattlePage() {
  const navigate = useNavigate();
  const { videoRef, isActive, startCamera, stopCamera, getStream } = useCamera();
  const { initialize, detect, isReady } = useFaceLandmarker();
  const { score: playerScore, processFrame, startScanning, reset: resetScore } = usePSLScore();
  const {
    createRoom, joinRoom, callPeer, sendData, disconnect,
    isHost, isConnected, isConnecting, roomCode, peerData, remoteStream, error: peerError
  } = usePeerConnection();

  const canvasRef = useRef(null);
  const videoWrapRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const animFrameRef = useRef(null);

  // lobby | camera-setup | countdown | scanning | overtime | results
  const [phase, setPhase] = useState('lobby');
  const [joinCode, setJoinCode] = useState('');
  const [countdown, setCountdown] = useState(READY_COUNTDOWN);
  const [timer, setTimer] = useState(SCAN_DURATION);
  const [overtimeTimer, setOvertimeTimer] = useState(OVERTIME_DURATION);
  const [playerAura, setPlayerAura] = useState(1200);
  const [opponentScore, setOpponentScore] = useState(null);
  const [opponentName, setOpponentName] = useState('Opponent');
  const [result, setResult] = useState(null);
  const [auraChange, setAuraChange] = useState(0);
  const [resultMsg, setResultMsg] = useState(null);
  const [myReady, setMyReady] = useState(false);
  const [opponentReady, setOpponentReady] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);

  const username = localStorage.getItem('mogged_username') || 'Player';

  useEffect(() => {
    if (!isLivenessVerified()) {
      navigate('/check', { replace: true });
    }
  }, [navigate]);

  // Load aura on mount
  useEffect(() => {
    setPlayerAura(loadAura());
    return () => {
      stopCamera();
      disconnect();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Attach remote stream to video element
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  // Handle creating a room
  const handleCreate = async () => {
    try {
      await createRoom();
    } catch (err) {
      console.error('Create room failed:', err);
    }
  };

  // Handle joining a room
  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    try {
      await joinRoom(joinCode.trim().toUpperCase());
    } catch (err) {
      console.error('Join room failed:', err);
    }
  };

  // When connected → go to camera-setup phase
  useEffect(() => {
    if (!isConnected) return;
    // Exchange usernames
    sendData({ type: 'username', name: username });
    // Move to camera setup
    setPhase('camera-setup');
  }, [isConnected]);

  // Camera setup — start camera + AI when entering this phase
  useEffect(() => {
    if (phase !== 'camera-setup') return;
    const init = async () => {
      await Promise.all([startCamera(), initialize()]);
    };
    init();
  }, [phase]);

  // Once camera is active, start the media call to share video
  useEffect(() => {
    if (phase !== 'camera-setup' || !isActive) return;
    const stream = getStream();
    if (stream) {
      // Small delay to let PeerJS connection stabilize
      setTimeout(() => {
        callPeer(stream);
      }, 500);
    }
  }, [phase, isActive, getStream, callPeer]);

  // Detection loop — runs during camera-setup (to detect face) and during battle
  const runDetection = useCallback(() => {
    if (!videoRef.current || !isReady || !isActive) {
      animFrameRef.current = requestAnimationFrame(runDetection);
      return;
    }
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const wrap = videoWrapRef.current;
    if (!canvas || !wrap) { animFrameRef.current = requestAnimationFrame(runDetection); return; }
    const ctx = canvas.getContext('2d');

    // Use container dimensions for canvas (fixes mobile offset)
    const cw = wrap.clientWidth;
    const ch = wrap.clientHeight;
    canvas.width = cw;
    canvas.height = ch;

    const detectionResult = detect(video);
    if (detectionResult) {
      setFaceDetected(true);

      // Calculate object-fit: cover transform
      const t = getCoverTransform(video, wrap);

      // Transform landmarks from video coords to canvas (container) coords
      const vw = video.videoWidth || 640;
      const vh = video.videoHeight || 480;
      const transformedLandmarks = detectionResult.landmarks.map(lm => ({
        ...lm,
        x: (lm.x * vw - t.offsetX) * t.scaleX / cw,
        y: (lm.y * vh - t.offsetY) * t.scaleY / ch,
      }));

      drawLandmarks(ctx, transformedLandmarks, cw, ch, {
        color: '#00ff88', pointSize: 1.5, lineWidth: 0.5, glowEffect: true,
      });

      if (phase === 'scanning' || phase === 'overtime') {
        processFrame(detectionResult.landmarks);
      }
    } else {
      setFaceDetected(false);
      ctx.clearRect(0, 0, cw, ch);
    }
    animFrameRef.current = requestAnimationFrame(runDetection);
  }, [isReady, isActive, detect, videoRef, phase, processFrame]);

  useEffect(() => {
    if (isActive && isReady) {
      animFrameRef.current = requestAnimationFrame(runDetection);
    }
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [isActive, isReady, runDetection]);

  // When face detected + camera active → mark self as ready and notify peer
  useEffect(() => {
    if (phase !== 'camera-setup' || myReady) return;
    if (isActive && faceDetected) {
      setMyReady(true);
      sendData({ type: 'camera-ready' });
    }
  }, [phase, isActive, faceDetected, myReady, sendData]);

  // Handle peer data
  useEffect(() => {
    if (!peerData) return;
    if (peerData.type === 'username') {
      setOpponentName(peerData.name);
    } else if (peerData.type === 'score') {
      setOpponentScore(peerData.score);
    } else if (peerData.type === 'camera-ready') {
      setOpponentReady(true);
    }
  }, [peerData]);

  // When both ready → start countdown
  useEffect(() => {
    if (phase !== 'camera-setup') return;
    if (myReady && opponentReady) {
      setTimeout(() => {
        setPhase('countdown');
        setCountdown(READY_COUNTDOWN);
      }, 500);
    }
  }, [phase, myReady, opponentReady]);

  // Countdown
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(t);
    } else {
      setPhase('scanning');
      setTimer(SCAN_DURATION);
      startScanning();
    }
  }, [phase, countdown, startScanning]);

  // Scanning timer
  useEffect(() => {
    if (phase !== 'scanning') return;
    if (timer > 0) {
      const t = setTimeout(() => setTimer(s => s - 1), 1000);
      return () => clearTimeout(t);
    } else {
      // Enter overtime
      setPhase('overtime');
      setOvertimeTimer(OVERTIME_DURATION);
    }
  }, [phase, timer]);

  // Overtime timer
  useEffect(() => {
    if (phase !== 'overtime') return;
    if (overtimeTimer > 0) {
      const t = setTimeout(() => setOvertimeTimer(s => s - 1), 1000);
      return () => clearTimeout(t);
    } else {
      // Send final score
      const finalScore = playerScore?.overall || 5.0;
      sendData({ type: 'score', score: finalScore });
      // Wait a bit for opponent score, then show results
      setTimeout(() => setPhase('results'), 2000);
    }
  }, [phase, overtimeTimer, playerScore, sendData]);

  // Send score periodically during scanning/overtime
  useEffect(() => {
    if (phase !== 'scanning' && phase !== 'overtime') return;
    const interval = setInterval(() => {
      if (playerScore) {
        sendData({ type: 'score', score: playerScore.overall });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, playerScore, sendData]);

  // Calculate results
  useEffect(() => {
    if (phase !== 'results') return;
    const pScore = playerScore?.overall || 5.0;
    const oScore = opponentScore || 5.0;
    const isWin = pScore >= oScore;
    setResult(isWin ? 'win' : 'loss');

    const winnerScore = Math.max(pScore, oScore);
    const loserScore = Math.min(pScore, oScore);
    setResultMsg(getResultMessage(winnerScore, loserScore));

    const opponentAura = playerAura + (Math.random() - 0.5) * 200;
    const { newAura, change } = calculateAura(playerAura, opponentAura, isWin ? 1 : 0);
    setAuraChange(change);
    saveAura(newAura);
    localStorage.setItem('mogged_last_score', String(pScore));
    saveMatch({
      result: isWin ? 'win' : 'loss',
      playerScore: pScore,
      opponentScore: oScore,
      opponentName,
      eloChange: change,
      newElo: newAura,
      timestamp: Date.now(),
      mode: 'private',
    });
  }, [phase]);

  const pScore = playerScore?.overall || 0;
  const pTier = playerScore ? getTier(pScore) : null;
  const oTier = opponentScore ? getTier(opponentScore) : null;
  const isWinner = result === 'win';

  // ==================== LOBBY PHASE ====================
  if (phase === 'lobby') {
    return (
      <div className="private-lobby">
        <Link to="/dashboard" className="battle-back">← Back</Link>
        <div className="private-lobby__card">
          <div style={{ fontSize: '3rem' }}>🔗</div>
          <div className="private-lobby__title">Private Room</div>
          <div className="private-lobby__subtitle">
            Battle a friend 1v1. Create a room or join with a code.
          </div>

          {!roomCode && !isConnecting && (
            <>
              <button className="btn-cta" onClick={handleCreate} id="create-room-btn">
                🏠 CREATE ROOM
              </button>

              <div className="private-lobby__or">— or join —</div>

              <div className="private-lobby__input-group">
                <input
                  className="private-lobby__input"
                  type="text"
                  placeholder="Enter room code..."
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleJoin()}
                  id="room-code-input"
                />
                <button
                  className="private-lobby__join-btn"
                  onClick={handleJoin}
                  disabled={!joinCode.trim()}
                  id="join-room-btn"
                >
                  JOIN
                </button>
              </div>
            </>
          )}

          {isConnecting && (
            <div className="private-lobby__waiting">
              <div className="battle-state__spinner" />
              <span className="battle-state__subtext">Connecting...</span>
            </div>
          )}

          {roomCode && !isConnected && !isConnecting && (
            <>
              <div className="private-lobby__subtitle">Share this code with your friend:</div>
              <div className="private-lobby__code" title="Click to copy" onClick={() => {
                navigator.clipboard?.writeText(roomCode);
              }}>
                {roomCode}
              </div>
              <div className="private-lobby__waiting">
                <div className="battle-state__spinner" />
                <span className="battle-state__subtext">Waiting for opponent to join...</span>
              </div>
            </>
          )}

          {isConnected && (
            <div className="private-lobby__connected">
              ✅ {opponentName || 'Opponent'} connected! Starting...
            </div>
          )}

          {peerError && (
            <div className="private-lobby__error">⚠️ {peerError}</div>
          )}
        </div>
      </div>
    );
  }

  // ==================== CAMERA SETUP PHASE ====================
  if (phase === 'camera-setup') {
    return (
      <div className="battle-page">
        <Link to="/dashboard" className="battle-back" onClick={() => { disconnect(); stopCamera(); }}>
          ← Leave
        </Link>

        <div className="camera-setup">
          <div className="camera-setup__title">📸 Camera Check</div>
          <div className="camera-setup__subtitle">
            Both players need their camera active and face detected to start.
          </div>

          <div className="camera-setup__panels">
            {/* Your camera */}
            <div className={`camera-setup__panel ${myReady ? 'camera-setup__panel--ready' : ''}`}>
              <div className="camera-setup__panel-label">YOU</div>
              <div className="camera-setup__video-wrap" ref={videoWrapRef}>
                <video ref={videoRef} playsInline muted />
                <canvas ref={canvasRef} />
                {!isActive && (
                  <div className="camera-setup__loading">
                    <div className="battle-state__spinner" />
                    <span>Starting camera...</span>
                  </div>
                )}
              </div>
              <div className={`camera-setup__status ${myReady ? 'camera-setup__status--ready' : ''}`}>
                {myReady ? '✅ Ready' : faceDetected ? '🔍 Detecting face...' : '📷 Waiting for camera...'}
              </div>
            </div>

            <div className="camera-setup__vs">VS</div>

            {/* Opponent camera */}
            <div className={`camera-setup__panel ${opponentReady ? 'camera-setup__panel--ready' : ''}`}>
              <div className="camera-setup__panel-label">{opponentName}</div>
              <div className="camera-setup__video-wrap">
                {remoteStream ? (
                  <video ref={remoteVideoRef} playsInline muted />
                ) : (
                  <div className="camera-setup__loading">
                    <div className="bot-avatar__icon" style={{ fontSize: '2.5rem' }}>👤</div>
                    <span>Waiting for camera...</span>
                  </div>
                )}
              </div>
              <div className={`camera-setup__status ${opponentReady ? 'camera-setup__status--ready' : ''}`}>
                {opponentReady ? '✅ Ready' : '⏳ Waiting...'}
              </div>
            </div>
          </div>

          {myReady && opponentReady && (
            <div className="camera-setup__go">
              🔥 Both ready! Starting battle...
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==================== BATTLE PHASE ====================
  return (
    <div className="battle-page">
      <Link to="/dashboard" className="battle-back" onClick={() => { disconnect(); stopCamera(); }}>
        ← Leave
      </Link>

      {/* Timer */}
      {(phase === 'scanning' || phase === 'overtime') && (
        <div className="battle-timer">
          <span className={`battle-timer__time ${phase === 'overtime' ? 'battle-timer__time--overtime' : ''}`}>
            {phase === 'overtime' ? `+${overtimeTimer}` : timer}s
          </span>
          <span className={`battle-timer__label ${phase === 'overtime' ? 'battle-timer__label--overtime' : ''}`}>
            {phase === 'overtime' ? '🔥 OVERTIME' : 'SCANNING'}
          </span>
          <div className="battle-timer__bar">
            <div
              className={`battle-timer__fill ${phase === 'overtime' ? 'battle-timer__fill--overtime' : ''}`}
              style={{
                width: phase === 'overtime'
                  ? `${(overtimeTimer / OVERTIME_DURATION) * 100}%`
                  : `${(timer / SCAN_DURATION) * 100}%`
              }}
            />
          </div>
        </div>
      )}

      <div className="battle-content">
        {/* YOUR PANEL */}
        <div className={`player-panel ${result === 'win' ? 'player-panel--winner' : result === 'loss' ? 'player-panel--loser' : ''}`}>
          {result === 'win' && <FireExplosion />}
          <div className="player-panel__video-wrap" ref={videoWrapRef}>
            <div className="player-panel__label" style={{ color: '#00ff88' }}>YOUR SCAN</div>
            <video ref={videoRef} playsInline muted />
            <canvas ref={canvasRef} />
            {(phase === 'scanning' || phase === 'overtime') && (
              <div className="scanning-overlay"><div className="scanning-overlay__line" /></div>
            )}
          </div>
          <div className="player-panel__info">
            <div className="player-info__left">
              <div className="player-info__score" style={{ color: pTier?.color || '#fff' }}>
                {(phase === 'scanning' || phase === 'overtime' || phase === 'results') ? pScore.toFixed(1) : '—'}
              </div>
              <div className="player-info__details">
                <span className="player-info__name">{username}</span>
                <span className="player-info__elo">✨ {playerAura} AP</span>
              </div>
            </div>
            <div className="player-info__right">
              {pTier && (
                <span className="tier-badge" style={{ background: pTier.color + '22', color: pTier.color, border: `1px solid ${pTier.color}44` }}>
                  {pTier.emoji} {pTier.name}
                </span>
              )}
              {playerScore?.dominant && (
                <span className="player-info__dom">
                  <span className="player-info__tag">DOM </span>
                  <span className="player-info__dom-label">{playerScore.dominant.label}</span>
                </span>
              )}
              {playerScore?.flaw && (
                <span className="player-info__dom">
                  <span className="player-info__tag">FLAW </span>
                  <span className="player-info__flaw-label">{playerScore.flaw.label}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* VS */}
        <div className="vs-badge">
          <div className="vs-badge__line" />
          <div className="vs-badge__text">⚡ VS ⚡</div>
          <div className="vs-badge__line" />
        </div>

        {/* OPPONENT PANEL */}
        <div className={`player-panel ${result === 'loss' ? 'player-panel--winner' : result === 'win' ? 'player-panel--loser' : ''}`}>
          {result === 'loss' && <FireExplosion />}
          <div className="player-panel__video-wrap">
            <div className="player-panel__label" style={{ color: '#ff4444' }}>ENEMY SCAN</div>
            {remoteStream ? (
              <video ref={remoteVideoRef} playsInline muted />
            ) : (
              <div className="bot-avatar">
                <div className="bot-avatar__icon">👤</div>
                <div className="bot-avatar__text">{opponentName}</div>
              </div>
            )}
            {(phase === 'scanning' || phase === 'overtime') && (
              <div className="scanning-overlay"><div className="scanning-overlay__line" style={{ animationDelay: '1s' }} /></div>
            )}
          </div>
          <div className="player-panel__info">
            <div className="player-info__left">
              <div className="player-info__score" style={{ color: oTier?.color || '#666' }}>
                {opponentScore ? opponentScore.toFixed(1) : '—'}
              </div>
              <div className="player-info__details">
                <span className="player-info__name">{opponentName}</span>
                <span className="player-info__elo">✨ ??? AP</span>
              </div>
            </div>
            <div className="player-info__right">
              {oTier && (
                <span className="tier-badge" style={{ background: oTier.color + '22', color: oTier.color, border: `1px solid ${oTier.color}44` }}>
                  {oTier.emoji} {oTier.name}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Countdown overlay */}
      {phase === 'countdown' && countdown > 0 && (
        <div className="battle-state">
          <div className="battle-state__countdown" key={countdown}>{countdown}</div>
        </div>
      )}

      {/* Results overlay */}
      {phase === 'results' && result && (
        <div className="battle-results">
          {resultMsg && (
            <>
              <div className="battle-results__message-emoji">{resultMsg.emoji}</div>
              <div className="battle-results__message" style={{ color: resultMsg.color }}>
                {resultMsg.text}
              </div>
            </>
          )}

          <div className={`battle-results__title ${result === 'win' ? 'battle-results__title--win' : 'battle-results__title--loss'}`}>
            {result === 'win' ? '🏆 YOU WIN' : '💀 YOU LOSE'}
          </div>

          <div className="battle-results__scores">
            <div className="battle-results__player">
              <div className="battle-results__player-score" style={{ color: pTier?.color }}>
                {pScore.toFixed(1)}
              </div>
              <div className="battle-results__player-name">{username}</div>
            </div>
            <div className="battle-results__vs">VS</div>
            <div className="battle-results__player">
              <div className="battle-results__player-score" style={{ color: oTier?.color }}>
                {(opponentScore || 0).toFixed(1)}
              </div>
              <div className="battle-results__player-name">{opponentName}</div>
            </div>
          </div>

          <div className={`battle-results__elo-change ${auraChange >= 0 ? 'battle-results__elo-change--positive' : 'battle-results__elo-change--negative'}`}>
            ✨ Aura Points: {auraChange >= 0 ? '+' : ''}{auraChange}
          </div>

          <div className="battle-results__buttons">
            <Link to="/dashboard" className="btn-cta" onClick={() => { disconnect(); stopCamera(); }}>
              ← Dashboard
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
