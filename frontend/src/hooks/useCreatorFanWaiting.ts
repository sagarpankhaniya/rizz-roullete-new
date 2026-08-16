import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getSocket } from '../services/socket';
import { isUserVip } from '../utils/user';
import {
  SOCKET_EVENTS,
  type CreatorFanWaitingPayload,
} from '../types/events';

const FLAG_KEY = 'rizz_creator_fan_waiting';

/** VIP creators on /deck get redirected to /match when a paid fan is waiting. */
export function useCreatorFanWaiting() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isUserVip()) return;

    const socket = getSocket();
    const onFanWaiting = (payload: CreatorFanWaitingPayload) => {
      const msg =
        payload?.message?.trim() ||
        `${payload?.fanIdentity || 'A fan'} paid to enter your room.`;
      sessionStorage.setItem(FLAG_KEY, msg);
      if (location.pathname !== '/match') {
        navigate('/match');
      }
    };

    socket.on(SOCKET_EVENTS.CREATOR_FAN_WAITING, onFanWaiting);
    return () => {
      socket.off(SOCKET_EVENTS.CREATOR_FAN_WAITING, onFanWaiting);
    };
  }, [location.pathname, navigate]);
}

export function consumeCreatorFanWaitingMessage(): string | null {
  const msg = sessionStorage.getItem(FLAG_KEY);
  if (msg) sessionStorage.removeItem(FLAG_KEY);
  return msg;
}
