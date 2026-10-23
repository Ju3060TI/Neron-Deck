import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/auth';
import AppShell from '@/components/AppShell';
import AuthScreen from '@/pages/AuthScreen';
import VaultPage from '@/pages/VaultPage';
import AgentsPage from '@/pages/AgentsPage';
import ChatPage from '@/pages/ChatPage';
import SettingsPage from '@/pages/SettingsPage';

function ProtectedRoutes() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-space flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/vault" replace />} />
        <Route path="/vault" element={<VaultPage />} />
        <Route path="/agents" element={<AgentsPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/auth"
            element={<PublicOnlyAuth />}
          />
          <Route path="*" element={<ProtectedRoutes />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

function PublicOnlyAuth() {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-space flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }
  if (session) return <Navigate to="/vault" replace />;
  return <AuthScreen />;
}
