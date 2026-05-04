import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCamera } from '../hooks/useCamera';
import { useFaceLandmarker } from '../hooks/useFaceLandmarker';
import { usePSLScore } from '../hooks/usePSLScore';
import { drawLandmarks } from '../utils/landmarks';
import { getTier } from '../utils/tiers';
import { generateBotScore } from '../utils/scoring';
import { calculateAura, loadAura, saveAura, saveMatch, generateBotAura, getResultMessage } from '../utils/aura';
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

const BOT_NAMES = [
  'AlphaJaw99', 'MogKing_X', 'ChadMode44', 'xX_Hunter_Xx', 'SynergyMog',
  'IronJaw_23', 'CantilTilt', 'GigaVibes', 'PSL_Lord', 'SkullMog88',
  'FaceMaxxer', 'JawlineGod', 'HunterEyes7', 'MogLord_01', 'TitanFace',
];

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

export default function BattlePage() {
  const navigate = useNavigate();
  const { videoRef, isActive, startCamera, stopCamera } = useCamera();
  const { initialize, detect, isReady } = useFaceLandmarker();
  const { score: playerScore, processFrame, startScanning, reset: resetScore } = usePSLScore();

  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  const [phase, setPhase] = useState(BATTLE_PHASES.SEARCHING);
  const [countdown, setCountdown] = useState(3);
  const [timer, setTimer] = useState(SCAN_DURATION);
  const [overtimeTimer, setOvertimeTimer] = useState(OVERTIME_DURATION);
  const [botScore, setBotScore] = useState(null);
  const [botName, setBotName] = useState('');
  const [botAura, setBotAura] = useState(1200);
  const [playerAura, setPlayerAura] = useState(1200);
  const [result, setResult] = useState(null);
  const [auraChange, setAuraChange] = useState(0);
  const [animatedBotScore, setAnimatedBotScore] = useState(0);
  const [resultMsg, setResultMsg] = useState(null);

  // Initialize on mount
  useEffect(() => {
    const init = async () => {
      await Promise.all([startCamera(), initialize()]);
    };
    init();
    const pAura = loadAura();
    setPlayerAura(pAura);
    setBotAura(generateBotAura(pAura));
    setBotName(BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)]);

    return () => {
      stopCamera();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Phase transitions
  useEffect(() => {
    let t;
    if (phase === BATTLE_PHASES.SEARCHING) {
      t = setTimeout(() => setPhase(BATTLE_PHASES.FOUND), 2500);
    } else if (phase === BATTLE_PHASES.FOUND) {
      t = setTimeout(() => { setPhase(BATTLE_PHASES.COUNTDOWN); setCountdown(3); }, 1500);
    } else if (phase === BATTLE_PHASES.COUNTDOWN) {
      if (countdown > 0) {
        t = setTimeout(() => setCountdown(c => c - 1), 1000);
      } else {
        setPhase(BATTLE_PHASES.SCANNING);
        setTimer(SCAN_DURATION);
        startScanning();
        setBotScore(generateBotScore());
      }
    }
    return () => clearTimeout(t);
  }, [phase, countdown, startScanning]);

  // Scanning timer
  useEffect(() => {
    if (phase !== BATTLE_PHASES.SCANNING) return;
    if (timer > 0) {
      const t = setTimeout(() => setTimer(s => s - 1), 1000);
      return () => clearTimeout(t);
    } else {
      setPhase(BATTLE_PHASES.OVERTIME);
      setOvertimeTimer(OVERTIME_DURATION);
    }
  }, [phase, timer]);

  // Overtime timer
  useEffect(() => {
    if (phase !== BATTLE_PHASES.OVERTIME) return;
    if (overtimeTimer > 0) {
      const t = setTimeout(() => setOvertimeTimer(s => s - 1), 1000);
      return () => clearTimeout(t);
    } else {
      setPhase(BATTLE_PHASES.RESULTS);
    }
  }, [phase, overtimeTimer]);

  // Animated bot score during scanning
  useEffect(() => {
    if ((phase !== BATTLE_PHASES.SCANNING && phase !== BATTLE_PHASES.OVERTIME) || !botScore) return;
    let frame = 0;
    const targetScore = botScore.overall;
    const interval = setInterval(() => {
      frame++;
      const progress = Math.min(1, frame / 50);
      const wobble = (1 - progress) * (Math.random() * 2 - 1);
      const current = targetScore * progress + (5 + wobble * 3) * (1 - progress);
      setAnimatedBotScore(parseFloat(Math.max(1, Math.min(10, current)).toFixed(1)));
    }, 200);
    return () => clearInterval(interval);
  }, [phase, botScore]);

  // Detection loop
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
    const r = detect(video);
    if (r) {
      drawLandmarks(ctx, r.landmarks, canvas.width, canvas.height, {
        color: '#00ff88', pointSize: 1.5, lineWidth: 0.5, glowEffect: true,
      });
      if (phase === BATTLE_PHASES.SCANNING || phase === BATTLE_PHASES.OVERTIME) {
        processFrame(r.landmarks);
      }
    }
    animFrameRef.current = requestAnimationFrame(runDetection);
  }, [isReady, isActive, detect, videoRef, phase, processFrame]);

  useEffect(() => {
    if (isActive && isReady) {
      animFrameRef.current = requestAnimationFrame(runDetection);
    }
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [isActive, isReady, runDetection]);

  // Calculate results
  useEffect(() => {
    if (phase !== BATTLE_PHASES.RESULTS || !botScore) return;
    const pScore = playerScore?.overall || 5.0;
    const isWin = pScore >= botScore.overall;
    setResult(isWin ? 'win' : 'loss');

    const winnerScore = Math.max(pScore, botScore.overall);
    const loserScore = Math.min(pScore, botScore.overall);
    setResultMsg(getResultMessage(winnerScore, loserScore));

    const { newAura, change } = calculateAura(playerAura, botAura, isWin ? 1 : 0);
    setAuraChange(change);
    saveAura(newAura);
    localStorage.setItem('mogged_last_score', String(pScore));
    saveMatch({
      result: isWin ? 'win' : 'loss',
      playerScore: pScore,
      opponentScore: botScore.overall,
      opponentName: botName,
      eloChange: change,
      newElo: newAura,
      timestamp: Date.now(),
    });
  }, [phase, botScore, playerScore, playerAura, botAura, botName]);

  const handleRematch = () => {
    resetScore();
    setBotScore(null);
    setResult(null);
    setAuraChange(0);
    setResultMsg(null);
    setCountdown(3);
    setTimer(SCAN_DURATION);
    setOvertimeTimer(OVERTIME_DURATION);
    setAnimatedBotScore(0);
    const pAura = loadAura();
    setPlayerAura(pAura);
    setBotAura(generateBotAura(pAura));
    setBotName(BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)]);
    setPhase(BATTLE_PHASES.SEARCHING);
  };

  const pScore = playerScore?.overall || 0;
  const pTier = playerScore ? getTier(pScore) : null;
  const bTier = botScore ? getTier(botScore.overall) : null;
  const username = localStorage.getItem('mogged_username') || 'You';

  return (
    <div className="battle-page">
      <Link to="/dashboard" className="battle-back">← Leave</Link>

      {/* Timer */}
      {(phase === BATTLE_PHASES.SCANNING || phase === BATTLE_PHASES.OVERTIME) && (
        <div className="battle-timer">
          <span className={`battle-timer__time ${phase === BATTLE_PHASES.OVERTIME ? 'battle-timer__time--overtime' : ''}`}>
            {phase === BATTLE_PHASES.OVERTIME ? `+${overtimeTimer}` : timer}s
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
          <div className="player-panel__video-wrap">
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
                  ? pScore.toFixed(1) : '—'}
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

        {/* VS BADGE */}
        <div className="vs-badge">
          <div className="vs-badge__line" />
          <div className="vs-badge__text">⚡ VS ⚡</div>
          <div className="vs-badge__line" />
        </div>

        {/* ENEMY PANEL */}
        <div className={`player-panel ${result === 'loss' ? 'player-panel--winner' : result === 'win' ? 'player-panel--loser' : ''}`}>
          {result === 'loss' && <FireExplosion />}
          <div className="player-panel__video-wrap">
            <div className="player-panel__label" style={{ color: '#ff4444' }}>ENEMY SCAN</div>
            <div className="bot-avatar">
              <div className="bot-avatar__icon">🎭</div>
              <div className="bot-avatar__text">
                {(phase === BATTLE_PHASES.SCANNING || phase === BATTLE_PHASES.OVERTIME) ? 'Scanning...' : botName || 'Opponent'}
              </div>
            </div>
            {(phase === BATTLE_PHASES.SCANNING || phase === BATTLE_PHASES.OVERTIME) && (
              <div className="scanning-overlay"><div className="scanning-overlay__line" style={{ animationDelay: '1s' }} /></div>
            )}
            <button className="report-btn">⚠ REPORT</button>
          </div>
          <div className="player-panel__info">
            <div className="player-info__left">
              <div className="player-info__score" style={{ color: bTier?.color || '#666' }}>
                {(phase === BATTLE_PHASES.SCANNING || phase === BATTLE_PHASES.OVERTIME)
                  ? animatedBotScore.toFixed(1)
                  : phase === BATTLE_PHASES.RESULTS && botScore
                    ? botScore.overall.toFixed(1)
                    : '—'}
              </div>
              <div className="player-info__details">
                <span className="player-info__name">{botName || '???'}</span>
                <span className="player-info__elo">✨ {botAura} AP</span>
              </div>
            </div>
            <div className="player-info__right">
              {bTier && phase !== BATTLE_PHASES.SEARCHING && (
                <span className="tier-badge" style={{ background: bTier.color + '22', color: bTier.color, border: `1px solid ${bTier.color}44` }}>
                  {bTier.emoji} {bTier.name}
                </span>
              )}
              {botScore?.dominant && phase === BATTLE_PHASES.RESULTS && (
                <span className="player-info__dom">
                  <span className="player-info__tag">DOM </span>
                  <span className="player-info__dom-label">{botScore.dominant.label}</span>
                </span>
              )}
              {botScore?.flaw && phase === BATTLE_PHASES.RESULTS && (
                <span className="player-info__dom">
                  <span className="player-info__tag">FLAW </span>
                  <span className="player-info__flaw-label">{botScore.flaw.label}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Battle State Overlays */}
      {phase === BATTLE_PHASES.SEARCHING && (
        <div className="battle-state">
          <div className="battle-state__searching">
            <div className="battle-state__spinner" />
            <div className="battle-state__text">Searching for opponent...</div>
            <div className="battle-state__subtext">Matching by Aura range</div>
          </div>
        </div>
      )}

      {phase === BATTLE_PHASES.FOUND && (
        <div className="battle-state">
          <div className="battle-state__found">OPPONENT FOUND</div>
          <div className="battle-state__subtext">{botName} · ✨ {botAura} AP</div>
        </div>
      )}

      {phase === BATTLE_PHASES.COUNTDOWN && countdown > 0 && (
        <div className="battle-state">
          <div className="battle-state__countdown" key={countdown}>{countdown}</div>
        </div>
      )}

      {/* Results */}
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
              <div className="battle-results__player-score" style={{ color: bTier?.color }}>{botScore?.overall.toFixed(1)}</div>
              <div className="battle-results__player-name">{botName}</div>
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
