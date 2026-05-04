/* eslint-disable react-hooks/set-state-in-effect, react-hooks/immutability, react-hooks/purity */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCamera } from '../hooks/useCamera';
import { useFaceLandmarker } from '../hooks/useFaceLandmarker';
import { usePSLScore } from '../hooks/usePSLScore';
import { usePeerConnection } from '../hooks/usePeerConnection';
import { useMatchmakingQueue } from '../hooks/useMatchmakingQueue';
import { usePublicMatch } from '../hooks/usePublicMatch';
import { useAuthSession } from '../hooks/useAuthSession';
import { drawLandmarks } from '../utils/landmarks';
import { getTier } from '../utils/tiers';
import { calculateAura, loadAura, saveAura, saveMatch, getResultMessage } from '../utils/aura';
import { isLivenessVerified } from '../utils/liveness';
import { updateProfileAfterMatch } from '../lib/profile';
import '../styles/battle.css';

const SCAN_DURATION = 10;
const OVERTIME_DURATION = 5;

const BATTLE_PHASES = {
  SEARCHING: 'searching',
  FOUND: 'found',
  COUNTDOWN: 'countdown',
  SCANNING: 'scanning',
  OVERTIME: 'overtime',
  RESULTS: 'results',
};

function getCoverTransform(video, container) {
  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 480;
  const cw = container.clientWidth;
  const ch = container.clientHeight;
  if (!cw || !ch) return { scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0 };

  const videoRatio = vw / vh;
  const containerRatio = cw / ch;
  let drawW;
  let drawH;
  let offsetX;
  let offsetY;

  if (containerRatio > videoRatio) {
    drawW = vw;
    drawH = vw / containerRatio;
    offsetX = 0;
    offsetY = (vh - drawH) / 2;
  } else {
    drawH = vh;
    drawW = vh * containerRatio;
    offsetX = (vw - drawW) / 2;
    offsetY = 0;
  }

  return { scaleX: cw / drawW, scaleY: ch / drawH, offsetX, offsetY };
}

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
        {embers.map((e) => (
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

export default function BattlePage() {
  const navigate = useNavigate();
  const { user } = useAuthSession();
  const username = localStorage.getItem('mogged_username') || 'You';
  const { videoRef, isActive, startCamera, stopCamera, getStream } = useCamera();
  const { initialize, detect, isReady } = useFaceLandmarker();
  const { score: playerScore, processFrame, startScanning, reset: resetScore } = usePSLScore();
  const { createRoom, joinRoom, callPeer, sendData, disconnect, isConnected, roomCode, peerData, remoteStream } = usePeerConnection();

  const [playerAura, setPlayerAura] = useState(1200);
  const [phase, setPhase] = useState(BATTLE_PHASES.SEARCHING);
  const [countdown, setCountdown] = useState(3);
  const [timer, setTimer] = useState(SCAN_DURATION);
  const [overtimeTimer, setOvertimeTimer] = useState(OVERTIME_DURATION);
  const [currentMatch, setCurrentMatch] = useState(null);
  const [opponentName, setOpponentName] = useState('Opponent');
  const [opponentAura, setOpponentAura] = useState(1200);
  const [opponentScore, setOpponentScore] = useState(null);
  const [myReady, setMyReady] = useState(false);
  const [opponentReady, setOpponentReady] = useState(false);
  const [peerRoomCode, setPeerRoomCode] = useState('');
  const [result, setResult] = useState(null);
  const [auraChange, setAuraChange] = useState(0);
  const [resultMsg, setResultMsg] = useState(null);

  const canvasRef = useRef(null);
  const videoWrapRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const animFrameRef = useRef(null);
  const readySentRef = useRef(false);
  const peerInitRef = useRef(false);

  const { userId, status: queueStatus, match, error: queueError, startQueue, leaveQueue } = useMatchmakingQueue({
    username,
    aura: playerAura,
  });

  useEffect(() => {
    if (!isLivenessVerified()) {
      navigate('/check', { replace: true });
    }
  }, [navigate]);

  const onMatchEvent = useCallback((event) => {
    if (event.type === 'ready') {
      setOpponentReady(true);
    } else if (event.type === 'score' || event.type === 'final-score') {
      if (typeof event.score === 'number') {
        setOpponentScore(event.score);
      }
    } else if (event.type === 'peer-room' && event.roomCode) {
      setPeerRoomCode(event.roomCode);
    } else if (event.type === 'left') {
      setPhase(BATTLE_PHASES.SEARCHING);
      setCurrentMatch(null);
      setOpponentReady(false);
      setMyReady(false);
      readySentRef.current = false;
      peerInitRef.current = false;
      setPeerRoomCode('');
      disconnect();
      startQueue();
    }
  }, [disconnect, startQueue]);

  const { sendEvent } = usePublicMatch({
    matchId: currentMatch?.matchId,
    selfId: userId,
    onEvent: onMatchEvent,
  });

  useEffect(() => {
    const init = async () => {
      const aura = loadAura();
      setPlayerAura(aura);
      await Promise.all([startCamera(), initialize()]);
      await startQueue();
    };
    init();

    return () => {
      sendEvent('left');
      leaveQueue();
      disconnect();
      stopCamera();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [disconnect, initialize, leaveQueue, sendEvent, startCamera, startQueue, stopCamera]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  useEffect(() => {
    if (!match || currentMatch) return;
    setCurrentMatch(match);
    const opponent = match.playerA.userId === userId ? match.playerB : match.playerA;
    setOpponentName(opponent.username || 'Opponent');
    setOpponentAura(Number(opponent.aura) || 1200);
    setPhase(BATTLE_PHASES.FOUND);
  }, [currentMatch, match, userId]);

  useEffect(() => {
    if (!currentMatch || !isActive || !isReady || readySentRef.current) return;
    readySentRef.current = true;
    setMyReady(true);
    sendEvent('ready');
  }, [currentMatch, isActive, isReady, sendEvent]);

  useEffect(() => {
    if (!currentMatch || peerInitRef.current) return;

    const initPeer = async () => {
      if (currentMatch.hostId === userId) {
        const generatedCode = `MOG-${currentMatch.matchId.slice(-6).toUpperCase()}`;
        await createRoom(generatedCode);
        setPeerRoomCode(generatedCode);
        sendEvent('peer-room', { roomCode: generatedCode });
      }
    };

    initPeer();
    peerInitRef.current = true;
  }, [createRoom, currentMatch, sendEvent, userId]);

  useEffect(() => {
    if (!currentMatch || currentMatch.hostId === userId || !peerRoomCode || isConnected) return;
    joinRoom(peerRoomCode);
  }, [currentMatch, isConnected, joinRoom, peerRoomCode, userId]);

  useEffect(() => {
    if (!isConnected || !isActive) return;
    const stream = getStream();
    if (!stream) return;
    callPeer(stream);
    sendData({ type: 'username', name: username });
  }, [callPeer, getStream, isActive, isConnected, sendData, username]);

  useEffect(() => {
    if (!peerData || peerData.type !== 'username') return;
    setOpponentName(peerData.name || 'Opponent');
  }, [peerData]);

  const runDetection = useCallback(() => {
    if (!videoRef.current || !isReady || !isActive) {
      animFrameRef.current = requestAnimationFrame(runDetection);
      return;
    }
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const wrap = videoWrapRef.current;
    if (!canvas || !wrap) {
      animFrameRef.current = requestAnimationFrame(runDetection);
      return;
    }
    const ctx = canvas.getContext('2d');
    const cw = wrap.clientWidth;
    const ch = wrap.clientHeight;
    canvas.width = cw;
    canvas.height = ch;

    const detection = detect(video);
    if (detection) {
      const t = getCoverTransform(video, wrap);
      const vw = video.videoWidth || 640;
      const vh = video.videoHeight || 480;
      const transformed = detection.landmarks.map((lm) => ({
        ...lm,
        x: (lm.x * vw - t.offsetX) * t.scaleX / cw,
        y: (lm.y * vh - t.offsetY) * t.scaleY / ch,
      }));
      drawLandmarks(ctx, transformed, cw, ch, {
        color: '#00ff88', pointSize: 1.5, lineWidth: 0.5, glowEffect: true,
      });
      if (phase === BATTLE_PHASES.SCANNING || phase === BATTLE_PHASES.OVERTIME) {
        processFrame(detection.landmarks);
      }
    } else {
      ctx.clearRect(0, 0, cw, ch);
    }
    animFrameRef.current = requestAnimationFrame(runDetection);
  }, [detect, isActive, isReady, phase, processFrame, videoRef]);

  useEffect(() => {
    if (isActive && isReady) {
      animFrameRef.current = requestAnimationFrame(runDetection);
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isActive, isReady, runDetection]);

  useEffect(() => {
    let t;
    if (phase === BATTLE_PHASES.FOUND && myReady && opponentReady) {
      t = setTimeout(() => {
        setPhase(BATTLE_PHASES.COUNTDOWN);
        setCountdown(3);
      }, 1200);
    } else if (phase === BATTLE_PHASES.COUNTDOWN) {
      if (countdown > 0) {
        t = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
      } else {
        setPhase(BATTLE_PHASES.SCANNING);
        setTimer(SCAN_DURATION);
        startScanning();
      }
    }
    return () => clearTimeout(t);
  }, [countdown, myReady, opponentReady, phase, startScanning]);

  useEffect(() => {
    if (phase !== BATTLE_PHASES.SCANNING) return undefined;
    if (timer > 0) {
      const t = setTimeout(() => setTimer((prev) => prev - 1), 1000);
      return () => clearTimeout(t);
    }
    setPhase(BATTLE_PHASES.OVERTIME);
    setOvertimeTimer(OVERTIME_DURATION);
    return undefined;
  }, [phase, timer]);

  useEffect(() => {
    if (phase !== BATTLE_PHASES.OVERTIME) return undefined;
    if (overtimeTimer > 0) {
      const t = setTimeout(() => setOvertimeTimer((prev) => prev - 1), 1000);
      return () => clearTimeout(t);
    }
    sendEvent('final-score', { score: playerScore?.overall || 5.0 });
    const done = setTimeout(() => setPhase(BATTLE_PHASES.RESULTS), 2000);
    return () => clearTimeout(done);
  }, [overtimeTimer, phase, playerScore, sendEvent]);

  useEffect(() => {
    if (phase !== BATTLE_PHASES.SCANNING && phase !== BATTLE_PHASES.OVERTIME) return;
    const i = setInterval(() => {
      if (playerScore?.overall) {
        sendEvent('score', { score: playerScore.overall });
      }
    }, 1000);
    return () => clearInterval(i);
  }, [phase, playerScore, sendEvent]);

  useEffect(() => {
    if (phase !== BATTLE_PHASES.RESULTS) return;
    const pScore = playerScore?.overall || 5;
    const oScore = opponentScore ?? 5;
    const isWin = pScore >= oScore;
    setResult(isWin ? 'win' : 'loss');

    const winnerScore = Math.max(pScore, oScore);
    const loserScore = Math.min(pScore, oScore);
    setResultMsg(getResultMessage(winnerScore, loserScore));

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
      mode: 'public-real',
    });

    updateProfileAfterMatch({
      userId: user?.id,
      newAura,
      result: isWin ? 'win' : 'loss',
      playerScore: pScore,
    }).catch(() => {});
  }, [opponentAura, opponentName, opponentScore, phase, playerAura, playerScore, user?.id]);

  const handleRematch = async () => {
    sendEvent('left');
    await leaveQueue();
    disconnect();
    resetScore();
    setOpponentScore(null);
    setOpponentReady(false);
    setMyReady(false);
    setCurrentMatch(null);
    setPeerRoomCode('');
    setResult(null);
    setResultMsg(null);
    setAuraChange(0);
    readySentRef.current = false;
    peerInitRef.current = false;
    setPhase(BATTLE_PHASES.SEARCHING);
    setCountdown(3);
    setTimer(SCAN_DURATION);
    setOvertimeTimer(OVERTIME_DURATION);
    startQueue();
  };

  const pScore = playerScore?.overall || 0;
  const pTier = playerScore ? getTier(pScore) : null;
  const oTier = typeof opponentScore === 'number' ? getTier(opponentScore) : null;

  return (
    <div className="battle-page">
      <Link
        to="/dashboard"
        className="battle-back"
        onClick={() => {
          sendEvent('left');
          leaveQueue();
          disconnect();
          stopCamera();
        }}
      >
        ← Leave
      </Link>

      {(phase === BATTLE_PHASES.SCANNING || phase === BATTLE_PHASES.OVERTIME) && (
        <div className="battle-timer">
          <span className={`battle-timer__time ${phase === BATTLE_PHASES.OVERTIME ? 'battle-timer__time--overtime' : ''}`}>
            {phase === BATTLE_PHASES.OVERTIME ? `+${overtimeTimer}` : `${timer}s`}
          </span>
          <span className={`battle-timer__label ${phase === BATTLE_PHASES.OVERTIME ? 'battle-timer__label--overtime' : ''}`}>
            {phase === BATTLE_PHASES.OVERTIME ? '🔥 OVERTIME' : 'SCANNING'}
          </span>
          <div className="battle-timer__bar">
            <div
              className={`battle-timer__fill ${phase === BATTLE_PHASES.OVERTIME ? 'battle-timer__fill--overtime' : ''}`}
              style={{
                width: phase === BATTLE_PHASES.OVERTIME
                  ? `${(overtimeTimer / OVERTIME_DURATION) * 100}%`
                  : `${(timer / SCAN_DURATION) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      <div className="battle-content">
        <div className={`player-panel ${result === 'win' ? 'player-panel--winner' : result === 'loss' ? 'player-panel--loser' : ''}`}>
          {result === 'win' && <FireExplosion />}
          <div className="player-panel__video-wrap" ref={videoWrapRef}>
            <div className="player-panel__label" style={{ color: '#00ff88' }}>YOUR SCAN</div>
            <video ref={videoRef} playsInline muted />
            <canvas ref={canvasRef} />
            {(phase === BATTLE_PHASES.SCANNING || phase === BATTLE_PHASES.OVERTIME) && (
              <div className="scanning-overlay"><div className="scanning-overlay__line" /></div>
            )}
          </div>
          <div className="player-panel__info">
            <div className="player-info__left">
              <div className="player-info__score" style={{ color: pTier?.color || '#fff' }}>
                {(phase === BATTLE_PHASES.SCANNING || phase === BATTLE_PHASES.OVERTIME || phase === BATTLE_PHASES.RESULTS)
                  ? pScore.toFixed(1)
                  : '—'}
              </div>
              <div className="player-info__details">
                <span className="player-info__name">{username}</span>
                <span className="player-info__elo">✨ {playerAura} AP</span>
              </div>
            </div>
          </div>
        </div>

        <div className="vs-badge">
          <div className="vs-badge__line" />
          <div className="vs-badge__text">⚡ VS ⚡</div>
          <div className="vs-badge__line" />
        </div>

        <div className={`player-panel ${result === 'loss' ? 'player-panel--winner' : result === 'win' ? 'player-panel--loser' : ''}`}>
          {result === 'loss' && <FireExplosion />}
          <div className="player-panel__video-wrap">
            <div className="player-panel__label" style={{ color: '#ff4444' }}>ENEMY SCAN</div>
            {remoteStream ? (
              <video ref={remoteVideoRef} playsInline muted />
            ) : (
              <div className="bot-avatar-enhanced">
                <div className="bot-avatar-enhanced__bg" />
                <div className="bot-avatar-enhanced__icon">👤</div>
                <div className="bot-avatar-enhanced__name">{opponentName}</div>
              </div>
            )}
          </div>
          <div className="player-panel__info">
            <div className="player-info__left">
              <div className="player-info__score" style={{ color: oTier?.color || '#666' }}>
                {typeof opponentScore === 'number' ? opponentScore.toFixed(1) : '—'}
              </div>
              <div className="player-info__details">
                <span className="player-info__name">{opponentName}</span>
                <span className="player-info__elo">✨ {opponentAura} AP</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {phase === BATTLE_PHASES.SEARCHING && (
        <div className="battle-state">
          <div className="battle-state__searching">
            <div className="battle-state__spinner" />
            <div className="battle-state__text">Searching for real opponent...</div>
            <div className="battle-state__subtext">
              {queueError ? queueError : queueStatus === 'searching' ? 'Waiting in public queue' : 'Initializing queue...'}
            </div>
          </div>
        </div>
      )}

      {phase === BATTLE_PHASES.FOUND && (
        <div className="battle-state">
          <div className="battle-state__found">OPPONENT FOUND</div>
          <div className="battle-state__subtext">
            {opponentName} · ✨ {opponentAura} AP · {roomCode || peerRoomCode || 'Linking P2P...'}
          </div>
        </div>
      )}

      {phase === BATTLE_PHASES.COUNTDOWN && countdown > 0 && (
        <div className="battle-state">
          <div className="battle-state__countdown" key={countdown}>{countdown}</div>
        </div>
      )}

      {phase === BATTLE_PHASES.RESULTS && result && (
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
              <div className="battle-results__player-score" style={{ color: pTier?.color }}>{pScore.toFixed(1)}</div>
              <div className="battle-results__player-name">{username}</div>
            </div>
            <div className="battle-results__vs">VS</div>
            <div className="battle-results__player">
              <div className="battle-results__player-score" style={{ color: oTier?.color }}>{(opponentScore || 0).toFixed(1)}</div>
              <div className="battle-results__player-name">{opponentName}</div>
            </div>
          </div>
          <div className={`battle-results__elo-change ${auraChange >= 0 ? 'battle-results__elo-change--positive' : 'battle-results__elo-change--negative'}`}>
            ✨ Aura Points: {auraChange >= 0 ? '+' : ''}{auraChange}
          </div>
          <div className="battle-results__buttons">
            <button className="btn-cta" onClick={handleRematch} id="rematch-btn">⚔️ REMATCH</button>
            <Link to="/dashboard" className="btn-secondary" id="back-dashboard">← Dashboard</Link>
          </div>
        </div>
      )}
    </div>
  );
}
