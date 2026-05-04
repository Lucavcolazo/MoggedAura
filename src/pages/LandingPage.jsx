import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../styles/landing.css';

function OnlineCounter() {
  const [count, setCount] = useState(6847);

  useEffect(() => {
    const interval = setInterval(() => {
      setCount(prev => {
        const delta = Math.floor(Math.random() * 40) - 18;
        return Math.max(5000, prev + delta);
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const formatted = count >= 1000
    ? (count / 1000).toFixed(1) + 'K'
    : count;

  return (
    <div className="online-counter">
      <span className="online-counter__dot" />
      <span className="online-counter__number">{formatted}</span>
      <span>ONLINE</span>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="landing">
      <div className="landing-content">
        {/* Hero Badge */}
        <div className="hero-badge">
          <span className="hero-badge__dot" />
          LIVE 1V1 MOG ARENA
        </div>

        {/* Hero Section */}
        <div className="hero-section">
          <h1 className="hero-title">
            <span>GET</span>
            <span className="hero-title__accent">MOGGED</span>
            <span>ONLINE</span>
          </h1>
          <p className="hero-subtitle">
            AI-powered facial analysis arena. Get your PSL score, 
            compete in real-time 1v1 battles, and climb the ranks.
          </p>
          <OnlineCounter />
        </div>

        {/* Arena Card */}
        <div className="arena-card">
          <div className="arena-card__icon">⚔️</div>
          <h2 className="arena-card__title">Enter The Arena</h2>
          <p className="arena-card__desc">
            Your camera scans your face using AI landmarks. 
            Get scored on symmetry, jawline, eye area, and more. 
            Then battle other players head-to-head.
          </p>
          <Link to="/check" className="btn-cta" id="start-camera-check">
            START CAMERA CHECK
            <span className="btn-cta__arrow">→</span>
          </Link>
        </div>

        {/* Steps */}
        <div className="steps-bar">
          <div className="step">
            <div className="step__number">
              <span className="step__icon">📷</span>
            </div>
            <span className="step__label">Camera Check</span>
          </div>
          <div className="step-connector" />
          <div className="step">
            <div className="step__number">
              <span className="step__icon">🧬</span>
            </div>
            <span className="step__label">Solo PSL Scan</span>
          </div>
          <div className="step-connector" />
          <div className="step">
            <div className="step__number">
              <span className="step__icon">⚔️</span>
            </div>
            <span className="step__label">Compete & Climb</span>
          </div>
        </div>

        {/* Secondary Buttons */}
        <div className="secondary-buttons">
          <Link to="/dashboard" className="btn-secondary" id="view-leaderboard">
            🏆 VIEW LEADERBOARD
          </Link>
          <a href="#" className="btn-secondary" id="join-discord">
            💬 JOIN DISCORD
          </a>
        </div>

        {/* Footer */}
        <footer className="landing-footer">
          <div className="landing-footer__divider" />
          <p className="landing-footer__text">
            Anti-abuse gate · 18+ acknowledgment · Not legal ID verification
            <br />
            All facial analysis is processed locally on your device. 
            No biometric data is ever uploaded or stored.
          </p>
        </footer>
      </div>
    </div>
  );
}
