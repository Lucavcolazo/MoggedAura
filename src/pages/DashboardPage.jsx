import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getTier } from '../utils/tiers';
import { loadAura, getRecord } from '../utils/aura';
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
  const navigate = useNavigate();
  const [aura, setAura] = useState(1200);
  const [username, setUsername] = useState('');
  const [record, setRecord] = useState({ wins: 0, losses: 0, total: 0 });
  const [lastScore, setLastScore] = useState(null);
  const [onlineCount, setOnlineCount] = useState(6847);

  useEffect(() => {
    setAura(loadAura());
    setRecord(getRecord());
    
    // Load or generate username
    let saved = localStorage.getItem('mogged_username');
    if (!saved) {
      saved = generateUsername();
      localStorage.setItem('mogged_username', saved);
    }
    setUsername(saved);

    // Load last score
    const score = localStorage.getItem('mogged_last_score');
    if (score) setLastScore(parseFloat(score));

    // Simulate online count
    const interval = setInterval(() => {
      setOnlineCount(prev => {
        const delta = Math.floor(Math.random() * 30) - 13;
        return Math.max(5000, prev + delta);
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const tier = lastScore ? getTier(lastScore) : getTier(5.5);
  const rankNumber = Math.max(1, Math.floor(10000 - aura * 3 + Math.random() * 200));

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
              <span className="user-header__stat-value">✨ {aura}</span>
              <span className="user-header__stat-label">AURA</span>
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
          </div>
        </div>

        {/* Mode Grid */}
        <div className="mode-grid">
          <Link to="/battle" className="mode-card" id="mode-1v1">
            <div className="mode-card__icon">⚔️</div>
            <div className="mode-card__title">1V1 Arena</div>
            <div className="mode-card__desc">
              Match against a random opponent. Your face gets scanned in real-time, 
              highest PSL score wins. Aura Points on the line.
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
              View the global leaderboard. See where you stand among 
              all players. Top moggers get special badges.
            </div>
            <div className="mode-card__arrow" style={{ color: 'var(--text-dim)' }}>
              Coming Soon
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
