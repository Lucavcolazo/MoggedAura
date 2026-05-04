// Barra global: marca, enlaces y resumen de Aura / PSL del usuario autenticado.
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthSession } from '../hooks/useAuthSession';
import { loadMyProfile } from '../lib/profile';
import { loadAura, saveAura } from '../utils/aura';
import '../styles/navbar.css';

export default function AppNavbar() {
  const { user, loading } = useAuthSession();
  const location = useLocation();
  const [displayName, setDisplayName] = useState('');
  const [aura, setAura] = useState(() => loadAura());
  const [psl, setPsl] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const onProfileUpdated = () => setRefreshTick((t) => t + 1);
    window.addEventListener('mogged-profile-updated', onProfileUpdated);
    return () => window.removeEventListener('mogged-profile-updated', onProfileUpdated);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const sync = async () => {
      setAura(loadAura());
      const localPsl = localStorage.getItem('mogged_last_score');
      if (localPsl) setPsl(parseFloat(localPsl));

      if (!user?.id) {
        setDisplayName('');
        return;
      }

      try {
        const profile = await loadMyProfile(user.id);
        if (cancelled || !profile) return;
        setDisplayName(profile.username || '');
        const ap = Number(profile.aura_points || 1200);
        setAura(ap);
        saveAura(ap);
        localStorage.setItem('mogged_username', profile.username || '');
        if (profile.best_psl != null && Number(profile.best_psl) > 0) {
          setPsl(Number(profile.best_psl));
        }
      } catch {
        if (!cancelled) {
          setDisplayName(localStorage.getItem('mogged_username') || '');
        }
      }
    };

    sync();
    return () => {
      cancelled = true;
    };
  }, [user?.id, refreshTick]);

  const hideNav =
    location.pathname === '/battle' ||
    location.pathname === '/private' ||
    location.pathname === '/check';

  if (hideNav) return null;

  return (
    <header className="app-navbar">
      <div className="app-navbar__inner">
        <Link to="/" className="app-navbar__brand" aria-label="Inicio Mogged">
          <span className="app-navbar__logo">⚡</span>
          <span className="app-navbar__title">
            MOGGED<span className="app-navbar__dot">.</span>ONLINE
          </span>
        </Link>

        <nav className="app-navbar__links" aria-label="Principal">
          {!loading && user && (
            <>
              <Link to="/dashboard" className="app-navbar__link">Arena</Link>
              <Link to="/lab" className="app-navbar__link">Lab</Link>
            </>
          )}
        </nav>

        <div className="app-navbar__user">
          {loading ? (
            <span className="app-navbar__muted">…</span>
          ) : user ? (
            <div className="app-navbar__pill">
              <span className="app-navbar__name">{displayName || 'Jugador'}</span>
              <span className="app-navbar__sep" aria-hidden />
              <span className="app-navbar__stat" title="Aura">
                Aura <strong>{aura}</strong>
              </span>
              <span className="app-navbar__stat" title="Mejor PSL">
                PSL <strong>{psl != null && !Number.isNaN(psl) ? psl.toFixed(1) : '—'}</strong>
              </span>
            </div>
          ) : (
            <Link to="/auth" className="app-navbar__cta">
              Entrar
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
