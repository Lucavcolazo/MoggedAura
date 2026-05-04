import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import CameraCheckPage from './pages/CameraCheckPage';
import DashboardPage from './pages/DashboardPage';
import BattlePage from './pages/BattlePage';
import LabPage from './pages/LabPage';
import PrivateBattlePage from './pages/PrivateBattlePage';
import { isLivenessVerified } from './utils/liveness';
import { useAuthSession } from './hooks/useAuthSession';

function ProtectedAuthRoute({ children }) {
  const { user, loading } = useAuthSession();
  if (loading) return null;
  return user ? children : <Navigate to="/auth" replace />;
}

function ProtectedBattleRoute({ children }) {
  return isLivenessVerified() ? children : <Navigate to="/check" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/check" element={<CameraCheckPage />} />
        <Route
          path="/dashboard"
          element={(
            <ProtectedAuthRoute>
              <DashboardPage />
            </ProtectedAuthRoute>
          )}
        />
        <Route
          path="/battle"
          element={(
            <ProtectedAuthRoute>
              <ProtectedBattleRoute>
                <BattlePage />
              </ProtectedBattleRoute>
            </ProtectedAuthRoute>
          )}
        />
        <Route
          path="/lab"
          element={(
            <ProtectedAuthRoute>
              <LabPage />
            </ProtectedAuthRoute>
          )}
        />
        <Route
          path="/private"
          element={(
            <ProtectedAuthRoute>
              <ProtectedBattleRoute>
                <PrivateBattlePage />
              </ProtectedBattleRoute>
            </ProtectedAuthRoute>
          )}
        />
      </Routes>
    </BrowserRouter>
  );
}
