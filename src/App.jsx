import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import CameraCheckPage from './pages/CameraCheckPage';
import DashboardPage from './pages/DashboardPage';
import BattlePage from './pages/BattlePage';
import LabPage from './pages/LabPage';
import PrivateBattlePage from './pages/PrivateBattlePage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/check" element={<CameraCheckPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/battle" element={<BattlePage />} />
        <Route path="/lab" element={<LabPage />} />
        <Route path="/private" element={<PrivateBattlePage />} />
      </Routes>
    </BrowserRouter>
  );
}
