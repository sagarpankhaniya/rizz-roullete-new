import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import LandingPage, { type RoomMode } from './components/LandingPage';
import { CallApp } from './components/CallApp';
import { clearToken, getToken, setToken } from './utils/auth';
import { clearStoredUser, setStoredUser } from './utils/user';
import { disconnectSocket } from './services/socket';
import { fetchProfile } from './services/profile';

type UserData = {
  firstName?: string;
  gender?: string | null;
  interestedIn?: string | null;
};

function AppShell() {
  const [screen, setScreen] = useState<'landing' | 'call'>('landing');
  const [bootstrapping, setBootstrapping] = useState(() => !!getToken());
  const [username, setUsername] = useState(() => {
    return localStorage.getItem('rizz_username') || 'Guest';
  });
  const [mode, setMode] = useState<RoomMode>(() => {
    const saved = localStorage.getItem('rizz_mode');
    return saved === 'unmoderated' ? 'unmoderated' : 'moderated';
  });

  const setModeAndStore = (nextMode: RoomMode) => {
    setMode(nextMode);
    localStorage.setItem('rizz_mode', nextMode);
  };

  const enterCall = () => setScreen('call');

  const applyUser = (userData: unknown) => {
    setStoredUser(userData);
    const user = userData as UserData | null;
    const name = user?.firstName?.trim();
    if (name) {
      setUsername(name);
      localStorage.setItem('rizz_username', name);
    }
  };

  // On reload: validate JWT via /api/profile, restore user, resume matching
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setBootstrapping(false);
      return;
    }

    let cancelled = false;

    const restore = async () => {
      try {
        const user = await fetchProfile();
        if (cancelled) return;
        if (!user) {
          setScreen('landing');
          return;
        }
        applyUser(user);
        // Fresh socket so matching JWT auth picks up the stored token
        disconnectSocket();
        setScreen('call');
      } catch {
        if (!cancelled) {
          clearToken();
          clearStoredUser();
          setScreen('landing');
        }
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    };

    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const onRegister = (userData: unknown, token: string) => {
    if (token) setToken(token);
    applyUser(userData);
    // Force a fresh socket so JWT auth picks up the new token
    disconnectSocket();
    enterCall();
  };

  const handleLogout = () => {
    disconnectSocket();
    clearToken();
    clearStoredUser();
    localStorage.removeItem('rizz_username');
    localStorage.removeItem('rizz_mode');
    setUsername('Guest');
    setMode('moderated');
    setScreen('landing');
  };

  if (bootstrapping) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#050505',
          color: '#fff0f7',
          fontFamily: 'Outfit, sans-serif',
          fontWeight: 700,
        }}
      >
        Starting…
      </div>
    );
  }

  if (screen === 'landing') {
    return (
      <LandingPage
        mode={mode}
        onModeChange={setModeAndStore}
        onRegister={onRegister}
      />
    );
  }

  return (
    <CallApp
      mode={mode}
      username={username}
      onClose={() => setScreen('landing')}
      onLogout={handleLogout}
    />
  );
}

function App() {
  return (
    <BrowserRouter basename="/admin">
      <Routes>
        <Route path="/" element={<AppShell />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
