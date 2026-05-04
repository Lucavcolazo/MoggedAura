import { Link } from 'react-router-dom';
import '../styles/landing.css';

export default function LandingPage() {
  return (
    <div className="landing landing--fullscreen">
      <div className="landing-content">
        <div className="hero-badge">
          <span className="hero-badge__dot" />
          LIVE 1V1 MOG ARENA
        </div>

        <div className="hero-section">
          <h1 className="hero-title hero-title--mogged">MOGGED</h1>
          <p className="hero-subtitle">
            Arena de análisis facial con IA. Obtené tu PSL, competí en 1v1 en tiempo real y subí en el ranking.
          </p>
        </div>

        <div className="arena-card">
          <div className="arena-card__icon">⚔️</div>
          <h2 className="arena-card__title">Entrá al ring</h2>
          <p className="arena-card__desc">
            La cámara escanea tu rostro con landmarks locales. Puntuación por simetría, mandíbula, ojos y más.
            Después enfrentate a otros jugadores.
          </p>
          <Link to="/auth" className="btn-cta" id="start-camera-check">
            Entrar / Registro
            <span className="btn-cta__arrow">→</span>
          </Link>
        </div>

        <div className="steps-bar">
          <div className="step">
            <div className="step__number">
              <span className="step__icon">📷</span>
            </div>
            <span className="step__label">Check cámara</span>
          </div>
          <div className="step-connector" />
          <div className="step">
            <div className="step__number">
              <span className="step__icon">🧬</span>
            </div>
            <span className="step__label">Scan PSL</span>
          </div>
          <div className="step-connector" />
          <div className="step">
            <div className="step__number">
              <span className="step__icon">⚔️</span>
            </div>
            <span className="step__label">Competí</span>
          </div>
        </div>

        <div className="secondary-buttons">
          <Link to="/auth" className="btn-secondary" id="view-leaderboard">
            🏆 Ranking
          </Link>
          <a href="#" className="btn-secondary" id="join-discord">
            💬 Discord
          </a>
        </div>

        <footer className="landing-footer">
          <div className="landing-footer__divider" />
          <p className="landing-footer__text">
            Gate anti-abuso · 18+ · No es verificación legal de identidad
            <br />
            El análisis facial se procesa en tu dispositivo; no subimos ni guardamos tu imagen.
          </p>
        </footer>
      </div>
    </div>
  );
}
