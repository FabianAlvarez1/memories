// =========================================================
// APP — Router + Auth Guard
// =========================================================

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import LoginPage from '@/pages/LoginPage';
import BrainPage from '@/pages/BrainPage';
import MemoryPage from '@/pages/MemoryPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireGuest({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  if (isAuthenticated) return <Navigate to="/brain" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route
          path="/login"
          element={
            <RequireGuest>
              <LoginPage />
            </RequireGuest>
          }
        />

        {/* Protected */}
        <Route
          path="/brain"
          element={
            <RequireAuth>
              <BrainPage />
            </RequireAuth>
          }
        />
        <Route
          path="/memory/:id"
          element={
            <RequireAuth>
              <MemoryPage />
            </RequireAuth>
          }
        />

        {/* Default */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
