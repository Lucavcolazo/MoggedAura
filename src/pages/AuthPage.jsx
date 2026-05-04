import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithEmail, signUpWithEmail } from '../lib/auth';
import { ensureProfile } from '../lib/profile';
import { saveAura, STARTING_AURA } from '../utils/aura';
import '../styles/landing.css';

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
          setInfo('Cuenta creada. Revisa tu mail para confirmar y luego inicia sesion.');
          return;
        }
      } else {
        response = await signInWithEmail(email, password);
      }

      const user = response.user || response.session?.user;
      if (user) {
        const profile = await ensureProfile(user, mode === 'signup' ? username : undefined);
        const aura = Number(profile?.aura_points || STARTING_AURA);
        saveAura(aura);
        localStorage.setItem('mogged_username', profile?.username || user.email?.split('@')[0] || 'Player');
      }

      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'No se pudo autenticar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="landing">
      <div className="landing-content">
        <Link to="/" className="dashboard-back">← Home</Link>
        <div className="arena-card" style={{ maxWidth: 520, margin: '0 auto' }}>
          <div className="arena-card__icon">🔐</div>
          <h2 className="arena-card__title">{mode === 'signup' ? 'Crear cuenta' : 'Iniciar sesion'}</h2>
          <p className="arena-card__desc">
            Usa email y contraseña para guardar Aura Points y aparecer en el scoreboard global.
          </p>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 10 }}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@dominio.com"
              required
              style={{ padding: 12, borderRadius: 8, border: '1px solid #2d2d2d', background: '#121212', color: '#fff' }}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimo 6 caracteres"
              minLength={6}
              required
              style={{ padding: 12, borderRadius: 8, border: '1px solid #2d2d2d', background: '#121212', color: '#fff' }}
            />
            {mode === 'signup' && (
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Tu username (a-z, 0-9, _)"
                minLength={3}
                maxLength={20}
                required
                style={{ padding: 12, borderRadius: 8, border: '1px solid #2d2d2d', background: '#121212', color: '#fff' }}
              />
            )}
            <button type="submit" className="btn-cta" disabled={loading}>
              {loading ? 'Procesando...' : mode === 'signup' ? 'Crear cuenta' : 'Entrar'}
            </button>
          </form>
          {error && <p style={{ color: '#ff6b6b', marginTop: 10 }}>{error}</p>}
          {info && <p style={{ color: '#00ff88', marginTop: 10 }}>{info}</p>}
          <button
            type="button"
            className="btn-secondary"
            style={{ marginTop: 12 }}
            onClick={() => setMode((prev) => (prev === 'signup' ? 'signin' : 'signup'))}
          >
            {mode === 'signup' ? 'Ya tengo cuenta' : 'No tengo cuenta'}
          </button>
        </div>
      </div>
    </div>
  );
}
