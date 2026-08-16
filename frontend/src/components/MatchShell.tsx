import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CallApp } from './CallApp';
import type { RoomMode } from './LandingPage';
import { clearToken, getToken } from '../utils/auth';
import { clearStoredUser, setStoredUser } from '../utils/user';
import { disconnectSocket } from '../services/socket';
import { fetchProfile } from '../services/profile';
import { getPendingCreatorId } from '../services/creators';
import {
  bootstrapCameraFromUserGesture,
  deviceNeedsCameraGesture,
  deviceRequiresCameraTapGate,
  discardBootstrappedCamera,
} from '../utils/cameraBootstrap';

type UserData = {
  firstName?: string;
  gender?: string | null;
  interestedIn?: string | null;
};

export function MatchShell() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [cameraGateBusy, setCameraGateBusy] = useState(false);
  const [needsCameraGate, setNeedsCameraGate] = useState(false);
  const [username, setUsername] = useState(
    () => localStorage.getItem('rizz_username') || 'Guest',
  );
  const [mode] = useState<RoomMode>(() => {
    const saved = localStorage.getItem('rizz_mode');
    return saved === 'unmoderated' ? 'unmoderated' : 'moderated';
  });

  const applyUser = (userData: unknown) => {
    setStoredUser(userData);
    const user = userData as UserData | null;
    const name = user?.firstName?.trim();
    if (name) {
      setUsername(name);
      localStorage.setItem('rizz_username', name);
    }
  };

  useEffect(() => {
    const token = getToken();
    if (!token) {
      navigate('/', { replace: true });
      return;
    }

    let cancelled = false;

    const restore = async () => {
      try {
        const user = await fetchProfile();
        if (cancelled) return;
        if (!user) {
          navigate('/', { replace: true });
          return;
        }
        applyUser(user);

        const pendingCreatorId = getPendingCreatorId();
        if (pendingCreatorId) {
          navigate(`/creator/${pendingCreatorId}`, { replace: true });
          return;
        }

        if (deviceRequiresCameraTapGate()) {
          setNeedsCameraGate(true);
        } else if (deviceNeedsCameraGesture()) {
          const opened = await bootstrapCameraFromUserGesture();
          if (cancelled) return;
          if (!opened) {
            setNeedsCameraGate(true);
          } else {
            setReady(true);
          }
        } else {
          setReady(true);
        }
      } catch {
        if (!cancelled) {
          clearToken();
          clearStoredUser();
          navigate('/', { replace: true });
        }
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    };

    void restore();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const handleLogout = () => {
    discardBootstrappedCamera();
    disconnectSocket();
    clearToken();
    clearStoredUser();
    localStorage.removeItem('rizz_username');
    navigate('/', { replace: true });
  };

  const handleCameraGateContinue = () => {
    if (cameraGateBusy) return;
    setCameraGateBusy(true);
    void bootstrapCameraFromUserGesture().finally(() => {
      setCameraGateBusy(false);
      setNeedsCameraGate(false);
      setReady(true);
    });
  };

  if (bootstrapping) {
    return (
      <div className="session-loading">
        Starting match…
      </div>
    );
  }

  if (needsCameraGate) {
    return (
      <div className="session-loading session-camera-gate">
        <div style={{ maxWidth: 320, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>💘</div>
          <p style={{ marginBottom: 24, opacity: 0.72 }}>
            Tap below to open your camera and start matching.
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

  if (!ready) return null;

  return (
    <CallApp mode={mode} username={username} onLogout={handleLogout} />
  );
}
