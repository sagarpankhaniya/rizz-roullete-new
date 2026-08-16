import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { CallApp } from './CallApp';
import { clearToken, getToken } from '../utils/auth';
import { clearStoredUser, setStoredUser } from '../utils/user';
import { disconnectSocket } from '../services/socket';
import { fetchProfile } from '../services/profile';
import {
  clearCreatorRoomEntry,
  hasCreatorEntryPaid,
} from '../services/creators';
import {
  bootstrapCameraFromUserGesture,
  deviceNeedsCameraGesture,
  deviceRequiresCameraTapGate,
  discardBootstrappedCamera,
} from '../utils/cameraBootstrap';

export function CreatorCallShell() {
  const navigate = useNavigate();
  const [bootstrapping, setBootstrapping] = useState(true);
  const [ready, setReady] = useState(false);
  const [needsCameraGate, setNeedsCameraGate] = useState(false);
  const [cameraGateBusy, setCameraGateBusy] = useState(false);
  const [username, setUsername] = useState(
    () => localStorage.getItem('rizz_username') || 'Guest',
  );
  const creatorName =
    localStorage.getItem('rizz_creator_room') || 'Creator';

  useEffect(() => {
    const token = getToken();
    if (!token || !hasCreatorEntryPaid()) {
      navigate('/deck', { replace: true });
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
        setStoredUser(user);
        const name = user.firstName?.trim();
        if (name) {
          setUsername(name);
          localStorage.setItem('rizz_username', name);
        }
        clearCreatorRoomEntry();

        // Reuse camera from /match when available
        if (!deviceRequiresCameraTapGate() && !deviceNeedsCameraGesture()) {
          setReady(true);
          return;
        }

        if (deviceRequiresCameraTapGate()) {
          setNeedsCameraGate(true);
        } else if (deviceNeedsCameraGesture()) {
          const opened = await bootstrapCameraFromUserGesture();
          if (cancelled) return;
          if (!opened) setNeedsCameraGate(true);
          else setReady(true);
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

  const handleLeaveToDeck = () => {
    discardBootstrappedCamera();
    disconnectSocket();
    navigate('/deck', { replace: true });
  };

  const handleGoToMatch = () => {
    navigate('/match', { replace: true });
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

  if (!getToken() || !hasCreatorEntryPaid()) {
    return <Navigate to="/deck" replace />;
  }

  if (bootstrapping) {
    return <div className="session-loading">Opening creator room…</div>;
  }

  if (needsCameraGate) {
    return (
      <div className="session-loading session-camera-gate">
        <div style={{ maxWidth: 320, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>💘</div>
          <p style={{ marginBottom: 24, opacity: 0.72 }}>
            Tap below to open your camera and join {creatorName}&apos;s room.
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
    <CallApp
      username={username}
      creatorName={creatorName}
      variant="creator"
      onLeaveRoom={handleLeaveToDeck}
      onGoToMatch={handleGoToMatch}
      onLogout={handleLeaveToDeck}
    />
  );
}
