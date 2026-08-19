import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { getSocket } from '../services/socket';
import { getStoredUser } from '../utils/user';
import { getCreatorId } from '../services/creators';
import {
  SOCKET_EVENTS,
  type CallPhase,
  type ErrorPayload,
  type LiveKitCredentials,
  type MatchedPayload,
  type PartnerLeftPayload,
  type StartCallPayload,
  type WaitingPayload,
} from '../types/events';

type StartCallAck =
  | ({ status: 'waiting' } & WaitingPayload)
  | { status: 'matched'; match: MatchedPayload | null }
  | { status: 'error'; message?: string };

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
  const [livekitSession, setLivekitSession] =
    useState<LiveKitCredentials | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const identityRef = useRef(identity);
  const phaseRef = useRef(phase);
  identityRef.current = identity;
  phaseRef.current = phase;

  const applyLivekitCredentials = useCallback((payload: LiveKitCredentials) => {
    setLivekitSession(payload);
  }, []);

  const applyMatched = useCallback(
    (payload: MatchedPayload, message?: string) => {
      setMatch(payload);
      setPhase((prev) => (prev === 'in_call' ? 'in_call' : 'matched'));
      applyLivekitCredentials(payload);
      setStatusMessage(
        message ??
          `Matched with ${payload.partnerIdentity}. Connecting to LiveKit…`,
      );
    },
    [applyLivekitCredentials],
  );

  const applyWaiting = useCallback(
    (payload: WaitingPayload) => {
      setPhase((prev) => {
        if (prev === 'matched' || prev === 'in_call') {
          return prev;
        }
        return 'waiting';
      });
      setStatusMessage(payload.message);
      applyLivekitCredentials(payload);
    },
    [applyLivekitCredentials],
  );

  const syncCallState = useCallback(() => {
    const socket = socketRef.current ?? getSocket();
    if (!socket.connected) {
      return;
    }
    socket.timeout(5000).emit(SOCKET_EVENTS.SYNC_CALL, {}, () => {
      // Response handled via call_resumed listener.
    });
  }, []);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    const onConnect = () => {
      setStatusMessage((prev) =>
        prev === 'Ready to start a call.' || phaseRef.current === 'idle'
          ? 'Connected to matching server.'
          : prev,
      );
      if (
        phaseRef.current === 'waiting' ||
        phaseRef.current === 'connecting'
      ) {
        syncCallState();
      }
    };

    const onWaiting = (payload: WaitingPayload) => {
      applyWaiting(payload);
    };

    const onMatched = (payload: MatchedPayload) => {
      applyMatched(payload);
    };

    const onCallResumed = (payload: MatchedPayload) => {
      applyMatched(payload, 'Reconnected — resuming your call…');
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
    socket.on(SOCKET_EVENTS.CALL_RESUMED, onCallResumed);
    socket.on(SOCKET_EVENTS.PARTNER_LEFT, onPartnerLeft);
    socket.on(SOCKET_EVENTS.ERROR, onError);

    return () => {
      socket.off('connect', onConnect);
      socket.off(SOCKET_EVENTS.WAITING, onWaiting);
      socket.off(SOCKET_EVENTS.MATCHED, onMatched);
      socket.off(SOCKET_EVENTS.CALL_RESUMED, onCallResumed);
      socket.off(SOCKET_EVENTS.PARTNER_LEFT, onPartnerLeft);
      socket.off(SOCKET_EVENTS.ERROR, onError);
    };
  }, [applyMatched, applyWaiting, syncCallState]);

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

      socket.timeout(15000).emit(
        SOCKET_EVENTS.START_CALL,
        payload,
        (err: Error | null, ack?: StartCallAck) => {
          if (err) {
            setPhase('error');
            setStatusMessage('Failed to join match queue. Please retry.');
            return;
          }
          if (!ack) return;
          if (ack.status === 'matched' && ack.match) {
            applyMatched(ack.match);
            return;
          }
          if (ack.status === 'waiting' && ack.message) {
            applyWaiting(ack);
          }
        },
      );
    };

    if (socket.connected) {
      emitStart();
      return;
    }

    setPhase('connecting');
    setStatusMessage('Connecting to server…');
    socket.connect();
    socket.once('connect', emitStart);
  }, [applyMatched, applyWaiting]);

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
    setLivekitSession(null);
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

  // Recover if the server matched us but the `matched` event was dropped.
  useEffect(() => {
    if (phase !== 'waiting' && phase !== 'connecting') {
      return;
    }

    const socket = socketRef.current ?? getSocket();
    let cancelled = false;

    const requestSync = () => {
      if (cancelled) return;
      syncCallState();
    };

    requestSync();
    const timer = window.setTimeout(requestSync, 800);
    const interval = window.setInterval(requestSync, 2500);

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        requestSync();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [phase, syncCallState]);

  return {
    phase,
    statusMessage,
    match,
    livekitSession,
    partnerLivekitIdentity: match?.partnerLivekitIdentity ?? null,
    startCall,
    leaveCall,
    reset,
    markInCall,
    markLiveKitError,
    syncCallState,
  };
};
