import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import LandingPage, { type RoomMode } from './components/LandingPage';
import { CallApp } from './components/CallApp';
import { clearToken, getToken, setToken } from './utils/auth';
import { clearStoredUser, setStoredUser } from './utils/user';
import { disconnectSocket } from './services/socket';
import { fetchProfile } from './services/profile';
import {
  bootstrapCameraFromUserGesture,
  deviceNeedsCameraGesture,
  deviceRequiresCameraTapGate,
  discardBootstrappedCamera,
} from './utils/cameraBootstrap';

type UserData = {
  firstName?: string;
  gender?: string | null;
  interestedIn?: string | null;
};

function AppShell() {
  const [screen, setScreen] = useState<'landing' | 'call' | 'camera_gate'>(
    'landing',
  );
  const [bootstrapping, setBootstrapping] = useState(() => !!getToken());
  const [cameraGateBusy, setCameraGateBusy] = useState(false);
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

  // On reload: validate JWT via /api/profile, restore user, resume matching.
  // Mobile/iOS cannot open the camera from a passive useEffect even when the
  // site already has permission — gate behind a tap that bootstraps the stream.
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
        if (deviceRequiresCameraTapGate()) {
          // iOS: getUserMedia from this async restore stack will fail even with
          // permission already granted — must wait for an explicit tap.
          setScreen('camera_gate');
        } else if (deviceNeedsCameraGesture()) {
          // Android / other touch: permission is usually enough without a tap.
          const opened = await bootstrapCameraFromUserGesture();
          if (cancelled) return;
          setScreen(opened ? 'call' : 'camera_gate');
        } else {
          setScreen('call');
        }
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
    // Kick off camera in this click stack (required on iOS), then enter call.
    void bootstrapCameraFromUserGesture().finally(() => {
      enterCall();
    });
  };

  const handleCameraGateContinue = () => {
    if (cameraGateBusy) return;
    setCameraGateBusy(true);
    void bootstrapCameraFromUserGesture().finally(() => {
      setCameraGateBusy(false);
      enterCall();
    });
  };

  const handleLogout = () => {
    discardBootstrappedCamera();
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
          fontFamily: 'Poppins, sans-serif',
          fontWeight: 700,
        }}
      >
        Starting…
      </div>
    );
  }

  if (screen === 'camera_gate') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: '24px',
          background: '#050505',
          color: '#fff0f7',
          fontFamily: 'Poppins, sans-serif',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 320 }}>
          <div style={{ fontSize: 48, lineHeight: 1, marginBottom: 16 }}>💘</div>
          <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 8 }}>
            Rizz Roulette
          </div>
          <p
            style={{
              margin: '0 0 24px',
              opacity: 0.72,
              fontWeight: 500,
              fontSize: 15,
              lineHeight: 1.45,
            }}
          >
            Camera permission is already set. Tap below to open your camera and
            continue.
          </p>
          <button
            type="button"
            className="hot-button"
            disabled={cameraGateBusy}
            onClick={handleCameraGateContinue}
            style={{ width: '100%', minHeight: 48 }}
          >
            {cameraGateBusy ? 'Opening camera…' : 'Continue'}
          </button>
        </div>
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
      onClose={() => {
        discardBootstrappedCamera();
        setScreen('landing');
      }}
      onLogout={handleLogout}
    />
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppShell />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
