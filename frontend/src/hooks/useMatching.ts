import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { getSocket } from '../services/socket';
import { getStoredUser } from '../utils/user';
import { getCreatorId } from '../services/creators';
import {
  SOCKET_EVENTS,
  type CallPhase,
  type ErrorPayload,
  type MatchedPayload,
  type PartnerLeftPayload,
  type StartCallPayload,
  type WaitingPayload,
} from '../types/events';

/**
 * Manages Socket.IO matching lifecycle:
 * idle → waiting → matched (with LiveKit credentials) → partner_left
 *
 * Gender / interestedIn come from registration (stored user + JWT on socket).
 */
export function useMatching(identity?: string) {
  const [phase, setPhase] = useState<CallPhase>('idle');
  const [statusMessage, setStatusMessage] = useState('Ready to start a call.');
  const [match, setMatch] = useState<MatchedPayload | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const identityRef = useRef(identity);
  identityRef.current = identity;

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    const onConnect = () => {
      setStatusMessage((prev) =>
        prev === 'Ready to start a call.' || phase === 'idle'
          ? 'Connected to matching server.'
          : prev,
      );
    };

    const onWaiting = (payload: WaitingPayload) => {
      setPhase('waiting');
      setStatusMessage(payload.message);
    };

    const onMatched = (payload: MatchedPayload) => {
      setMatch(payload);
      setPhase('matched');
      setStatusMessage(
        `Matched with ${payload.partnerIdentity}. Connecting to LiveKit…`,
      );
    };

    const onPartnerLeft = (payload: PartnerLeftPayload) => {
      setMatch(null);
      setPhase('partner_left');
      setStatusMessage(payload.reason);
    };

    const onError = (payload: ErrorPayload) => {
      setPhase('error');
      setStatusMessage(payload.message);
    };

    socket.on('connect', onConnect);
    socket.on(SOCKET_EVENTS.WAITING, onWaiting);
    socket.on(SOCKET_EVENTS.MATCHED, onMatched);
    socket.on(SOCKET_EVENTS.PARTNER_LEFT, onPartnerLeft);
    socket.on(SOCKET_EVENTS.ERROR, onError);

    return () => {
      socket.off('connect', onConnect);
      socket.off(SOCKET_EVENTS.WAITING, onWaiting);
      socket.off(SOCKET_EVENTS.MATCHED, onMatched);
      socket.off(SOCKET_EVENTS.PARTNER_LEFT, onPartnerLeft);
      socket.off(SOCKET_EVENTS.ERROR, onError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCall = useCallback(() => {
    const socket = socketRef.current ?? getSocket();

    const emitStart = () => {
      setPhase('connecting');
      setStatusMessage('Joining waiting queue…');
      setMatch(null);

      const stored = getStoredUser();
      const name = identityRef.current?.trim() || stored?.firstName?.trim();
      const payload: StartCallPayload = {};
      if (name) payload.identity = name;
      if (stored?.gender) payload.gender = stored.gender;
      if (stored?.interestedIn) payload.interestedIn = stored.interestedIn;

      const targetCreatorUserId = getCreatorId();
      if (targetCreatorUserId) {
        payload.targetCreatorUserId = targetCreatorUserId;
      }

      socket.emit(SOCKET_EVENTS.START_CALL, payload);
    };

    if (socket.connected) {
      emitStart();
      return;
    }

    setPhase('connecting');
    setStatusMessage('Connecting to server…');
    socket.connect();
    socket.once('connect', emitStart);
  }, []);

  const leaveCall = useCallback(() => {
    return new Promise<void>((resolve) => {
      const socket = socketRef.current ?? getSocket();
      let settled = false;

      const finish = () => {
        if (settled) return;
        settled = true;
        setMatch(null);
        setPhase('idle');
        setStatusMessage('You left the call.');
        resolve();
      };

      // Wait for server leave ack so re-queue isn't ignored as "still in call"
      socket.timeout(2500).emit(SOCKET_EVENTS.LEAVE_CALL, {}, () => {
        finish();
      });

      // Fallback if ack never arrives
      window.setTimeout(finish, 2600);
    });
  }, []);

  const reset = useCallback(() => {
    setMatch(null);
    setPhase('idle');
    setStatusMessage('Ready to start a call.');
  }, []);

  const markInCall = useCallback(() => {
    setPhase('in_call');
    setStatusMessage('Connected — video and audio active.');
  }, []);

  const markLiveKitError = useCallback((message: string) => {
    setPhase('error');
    setStatusMessage(message);
  }, []);

  return {
    phase,
    statusMessage,
    match,
    startCall,
    leaveCall,
    reset,
    markInCall,
    markLiveKitError,
  };
}
