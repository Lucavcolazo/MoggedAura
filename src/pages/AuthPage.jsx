import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithEmail, signUpWithEmail } from '../lib/auth';
import { ensureProfile } from '../lib/profile';
import { saveAura, STARTING_AURA } from '../utils/aura';
import '../styles/auth.css';

export default function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');
    try {
      let response;
      if (mode === 'signup') {
        response = await signUpWithEmail(email, password);
        if (!response.session) {
          setInfo('Cuenta creada. Revisa tu correo para confirmar y luego inicia sesión.');
          return;
        }
      } else {
        response = await signInWithEmail(email, password);
      }

      const sessionUser = response.user || response.session?.user;
      if (sessionUser) {
        const profile = await ensureProfile(sessionUser, mode === 'signup' ? username : undefined);
        const auraVal = Number(profile?.aura_points || STARTING_AURA);
        saveAura(auraVal);
        localStorage.setItem('mogged_username', profile?.username || sessionUser.email?.split('@')[0] || 'Player');
        window.dispatchEvent(new CustomEvent('mogged-profile-updated'));
      }

      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'No se pudo completar la operación.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__brand">
          <span className="auth-card__brand-mark" aria-hidden>⚡</span>
          <span className="auth-card__brand-name">MOGGED.ONLINE</span>
        </div>

        <div className="auth-card__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signin'}
            className={`auth-card__tab ${mode === 'signin' ? 'auth-card__tab--active' : ''}`}
            onClick={() => { setMode('signin'); setError(''); setInfo(''); }}
          >
            Entrar
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signup'}
            className={`auth-card__tab ${mode === 'signup' ? 'auth-card__tab--active' : ''}`}
            onClick={() => { setMode('signup'); setError(''); setInfo(''); }}
          >
            Registro
          </button>
        </div>

        <h1 className="auth-card__title">
          {mode === 'signup' ? 'Nueva cuenta' : 'Iniciar sesión'}
        </h1>
        <p className="auth-card__subtitle">
          {mode === 'signup'
            ? 'Elige un nombre público y guarda tu Aura en la nube.'
            : 'Accede para sincronizar Aura, PSL y el scoreboard.'}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="auth-label" htmlFor="auth-email">Correo</label>
            <input
              id="auth-email"
              className="auth-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="auth-password">Contraseña</label>
            <input
              id="auth-password"
              className="auth-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              minLength={6}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              required
            />
          </div>

          {mode === 'signup' && (
            <div className="auth-field">
              <label className="auth-label" htmlFor="auth-username">Nombre de usuario</label>
              <input
                id="auth-username"
                className="auth-input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="solo letras, números y guión bajo"
                minLength={3}
                maxLength={20}
                autoComplete="username"
                required
              />
            </div>
          )}

          <button type="submit" className="btn-cta auth-submit" disabled={loading}>
            {loading ? 'Espera…' : mode === 'signup' ? 'Crear cuenta' : 'Entrar'}
          </button>
        </form>

        {error && <p className="auth-msg auth-msg--error">{error}</p>}
        {info && <p className="auth-msg auth-msg--ok">{info}</p>}

        <p className="auth-hint">
          <Link to="/" style={{ color: 'var(--accent-green)' }}>← Volver al inicio</Link>
        </p>
      </div>
    </div>
  );
}
