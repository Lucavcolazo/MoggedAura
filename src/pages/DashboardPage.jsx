import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getTier } from '../utils/tiers';
import { loadAura, getRecord } from '../utils/aura';
import { fetchTopScoreboard, loadMyProfile, updateMyUsername } from '../lib/profile';
import { signOutUser } from '../lib/auth';
import { useAuthSession } from '../hooks/useAuthSession';
import '../styles/dashboard.css';

function generateUsername() {
  const adjectives = ['Shadow', 'Dark', 'Iron', 'Steel', 'Frost', 'Storm', 'Ghost', 'Neon', 'Void', 'Apex'];
  const nouns = ['Mogger', 'Slayer', 'Hunter', 'Titan', 'Reaper', 'Wolf', 'Hawk', 'Phantom', 'Viper', 'Rex'];
  const num = Math.floor(Math.random() * 99) + 1;
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adj}${noun}${num}`;
}

export default function DashboardPage() {
  const { user } = useAuthSession();
  const [aura, setAura] = useState(1200);
  const [username, setUsername] = useState('');
  const [record, setRecord] = useState({ wins: 0, losses: 0, total: 0 });
  const [lastScore, setLastScore] = useState(null);
  const [onlineCount, setOnlineCount] = useState(6847);
  const [scoreboard, setScoreboard] = useState([]);
  const [usernameDraft, setUsernameDraft] = useState('');
  const [profileMsg, setProfileMsg] = useState('');
  const [profileMsgIsError, setProfileMsgIsError] = useState(false);

  useEffect(() => {
    const boot = async () => {
      setAura(loadAura());
      setRecord(getRecord());

      let saved = localStorage.getItem('mogged_username');
      if (!saved) {
        saved = generateUsername();
        localStorage.setItem('mogged_username', saved);
      }

      if (user?.id) {
        const profile = await loadMyProfile(user.id);
        if (profile) {
          saved = profile.username || saved;
          setAura(Number(profile.aura_points || 1200));
          setRecord({
            wins: Number(profile.wins || 0),
            losses: Number(profile.losses || 0),
            total: Number(profile.wins || 0) + Number(profile.losses || 0),
          });
          if (profile.best_psl) setLastScore(Number(profile.best_psl));
          localStorage.setItem('mogged_username', saved);
        }
      } else {
        const score = localStorage.getItem('mogged_last_score');
        if (score) setLastScore(parseFloat(score));
      }

      setUsername(saved);
      setUsernameDraft(saved);
      const top = await fetchTopScoreboard(10);
      setScoreboard(top);
    };

    boot();

    // Simulate online count
    const interval = setInterval(() => {
      setOnlineCount(prev => {
        const delta = Math.floor(Math.random() * 30) - 13;
        return Math.max(5000, prev + delta);
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const tier = lastScore ? getTier(lastScore) : getTier(5.5);
  const rankNumber = Math.max(1, Math.floor(10000 - aura * 3 + record.wins * 11 - record.losses * 7));

  const formattedOnline = onlineCount >= 1000
    ? (onlineCount / 1000).toFixed(1) + 'K'
    : onlineCount;

  return (
    <div className="dashboard">
      <div className="dashboard-content">
        <Link to="/" className="dashboard-back">← Home</Link>
        
        <div className="dashboard-online">
          <span className="dashboard-online__dot" />
          <strong>{formattedOnline}</strong> PLAYERS ONLINE
        </div>

        {/* User Header */}
        <div className="user-header">
          <div className="user-header__left">
            <div className="user-header__avatar" style={{ borderColor: tier.color }}>
              {tier.emoji}
            </div>
            <div className="user-header__info">
              <span className="user-header__name">{username}</span>
              <span className="user-header__rank">
                <span style={{ color: tier.color }}>{tier.name}</span> · MOGGER #{rankNumber}
              </span>
            </div>
          </div>
          <div className="user-header__right">
            <div className="user-header__stat">
              <span className="user-header__stat-value">{aura}</span>
              <span className="user-header__stat-label">Aura</span>
            </div>
            <div className="user-header__stat">
              <span className="user-header__stat-value" style={{ color: tier.color }}>
                {lastScore || '—'}
              </span>
              <span className="user-header__stat-label">PSL</span>
            </div>
            <div className="user-header__stat">
              <span className="user-header__stat-value">
                {record.wins}W-{record.losses}L
              </span>
              <span className="user-header__stat-label">Record</span>
            </div>
            <button
              className="btn-secondary"
              onClick={async () => {
                await signOutUser();
                localStorage.removeItem('mogged_liveness_verified_at');
                window.location.href = '/auth';
              }}
            >
              Logout
            </button>
          </div>
        </div>

        <div className="mode-card" style={{ marginBottom: 16 }}>
          <div className="mode-card__icon">👤</div>
          <div className="mode-card__title">Perfil</div>
          <div className="mode-card__desc">
            En tu perfil se guardan: <strong>nombre</strong>, <strong>victorias</strong>, <strong>derrotas</strong>,{' '}
            <strong>Aura</strong> y <strong>PSL</strong> (mejor puntuación). El nombre también se puede editar aquí.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input
              value={usernameDraft}
              onChange={(e) => setUsernameDraft(e.target.value)}
              maxLength={20}
              placeholder="Nuevo username"
              style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #2d2d2d', background: '#121212', color: '#fff' }}
            />
            <button
              className="btn-cta"
              onClick={async () => {
                setProfileMsg('');
                setProfileMsgIsError(false);
                try {
                  if (!user?.id) return;
                  const updated = await updateMyUsername(user.id, usernameDraft);
                  const nextUsername = updated?.username || usernameDraft;
                  setUsername(nextUsername);
                  setUsernameDraft(nextUsername);
                  localStorage.setItem('mogged_username', nextUsername);
                  setProfileMsg('Nombre guardado en la base de datos.');
                  setProfileMsgIsError(false);
                  window.dispatchEvent(new CustomEvent('mogged-profile-updated'));
                  const top = await fetchTopScoreboard(10);
                  setScoreboard(top);
                } catch (err) {
                  setProfileMsgIsError(true);
                  setProfileMsg(err.message || 'No se pudo actualizar el nombre.');
                }
              }}
            >
              Guardar
            </button>
          </div>
          {profileMsg && (
            <div style={{ marginTop: 8, color: profileMsgIsError ? '#ff6b6b' : '#00ff88' }}>
              {profileMsg}
            </div>
          )}
        </div>

        {/* Mode Grid */}
        <div className="mode-grid">
          <Link to="/battle" className="mode-card" id="mode-1v1">
            <div className="mode-card__icon">⚔️</div>
            <div className="mode-card__title">1V1 Arena</div>
            <div className="mode-card__desc">
              Enfréntate a un rival al azar con escaneo en tiempo real; gana quien tenga mayor PSL y tu Aura se actualiza.
            </div>
            <div className="mode-card__arrow">→ Enter Match</div>
          </Link>

          <Link to="/lab" className="mode-card" id="mode-lab">
            <div className="mode-card__icon">🧪</div>
            <div className="mode-card__title">The Lab</div>
            <div className="mode-card__desc">
              Solo scan mode. Analyze your face with AI landmarks 
              without any opponent. Practice and explore.
            </div>
            <div className="mode-card__arrow">→ Start Scan</div>
          </Link>

          <div className="mode-card" id="mode-rank" style={{ cursor: 'default' }}>
            <div className="mode-card__icon">🏆</div>
            <div className="mode-card__title">Global Rank</div>
            <div className="mode-card__desc">
              {scoreboard.length > 0 ? (
                <div style={{ display: 'grid', gap: 6 }}>
                  {scoreboard.slice(0, 5).map((row, i) => (
                    <div key={row.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span>#{i + 1} {row.username}</span>
                      <span>Aura {row.aura_points}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <>View the global leaderboard. See where you stand among all players.</>
              )}
            </div>
            <div className="mode-card__arrow" style={{ color: 'var(--text-dim)' }}>
              Live via Supabase
            </div>
          </div>

          <Link to="/private" className="mode-card" id="mode-private">
            <div className="mode-card__icon">🔗</div>
            <div className="mode-card__title">Private Room</div>
            <div className="mode-card__desc">
              Create a room or join with a code to battle a friend 1v1.
              10s scan + 5s overtime. The ultimate mog showdown.
            </div>
            <div className="mode-card__arrow">→ Create / Join Room</div>
          </Link>
        </div>
      </div>
    </div>
  );
}
