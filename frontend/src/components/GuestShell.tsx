import { Navigate, useNavigate } from 'react-router-dom';
import LandingPage, { type RoomMode } from './LandingPage';
import { getToken, setToken } from '../utils/auth';
import { setStoredUser } from '../utils/user';
import { disconnectSocket } from '../services/socket';
import {
  clearPendingCreator,
  getPendingCreatorId,
  hasPendingCreatorSignup,
} from '../services/creators';
import { bootstrapCameraFromUserGesture } from '../utils/cameraBootstrap';
import { useState } from 'react';

type UserData = {
  firstName?: string;
};

export function GuestShell() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<RoomMode>(() => {
    const saved = localStorage.getItem('rizz_mode');
    return saved === 'unmoderated' ? 'unmoderated' : 'moderated';
  });

  if (getToken()) {
    return <Navigate to="/match" replace />;
  }

  const setModeAndStore = (nextMode: RoomMode) => {
    setMode(nextMode);
    localStorage.setItem('rizz_mode', nextMode);
  };

  const onRegister = (
    userData: unknown,
    token: string,
    destination: 'match' | 'deck' | 'creator' = 'match',
  ) => {
    if (token) setToken(token);
    setStoredUser(userData);
    const user = userData as UserData | null;
    const name = user?.firstName?.trim();
    if (name) localStorage.setItem('rizz_username', name);
    disconnectSocket();

    if (destination === 'creator') {
      const pendingCreatorId = getPendingCreatorId();
      clearPendingCreator();
      if (pendingCreatorId) {
        navigate(`/creator/${pendingCreatorId}`, { replace: true });
        return;
      }
    } else {
      clearPendingCreator();
    }

    // Navigate immediately — don't block on camera bootstrap.
    // On mobile (especially after a Google OAuth popup) getUserMedia is no
    // longer inside a user-gesture stack and can hang indefinitely.
    // The match page requests the camera again with its own gesture gate.
    if (destination === 'deck') {
      navigate('/deck', { replace: true });
    } else {
      navigate('/match', { replace: true });
    }

    // Fire-and-forget: pre-warm camera in background where possible
    void bootstrapCameraFromUserGesture();
  };

  return (
    <LandingPage
      mode={mode}
      onModeChange={setModeAndStore}
      onRegister={onRegister}
      pendingCreatorRoom={hasPendingCreatorSignup()}
    />
  );
}
