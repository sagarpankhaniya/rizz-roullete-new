import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { getSocket } from '../services/socket';
import { getStoredUser } from '../utils/user';
import { getCreatorId } from '../services/creators';
import { apiUrl } from '../utils/api';
import { authHeaders } from '../utils/auth';
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
  const matchRef = useRef(match);
  const livekitSessionRef = useRef(livekitSession);
  identityRef.current = identity;
  phaseRef.current = phase;
  matchRef.current = match;
  livekitSessionRef.current = livekitSession;

  const applyLivekitCredentials = useCallback((payload: LiveKitCredentials) => {
    livekitSessionRef.current = payload;
    setLivekitSession(payload);
  }, []);

  const applyMatched = useCallback(
    (payload: MatchedPayload, message?: string) => {
      const current = matchRef.current;
      const sameCall = current?.sessionId === payload.sessionId;

      // Duplicate socket/HTTP delivery — avoid re-render + subscription churn.
      if (
        sameCall &&
        current?.partnerLivekitIdentity === payload.partnerLivekitIdentity &&
        livekitSessionRef.current?.token
      ) {
        return;
      }

      matchRef.current = payload;
      setMatch(payload);
      setPhase((prev) => (prev === 'in_call' ? 'in_call' : 'matched'));
      setStatusMessage(
        message ??
          `Matched with ${payload.partnerIdentity}. Connecting to LiveKit…`,
      );

      // Waiter already joined the pool on waiting credentials — same room, new
      // token must not tear down LiveKit (causes black flash + reconnect).
      const alreadyInPool =
        livekitSessionRef.current?.roomName === payload.roomName &&
        Boolean(livekitSessionRef.current?.token);

      if (!alreadyInPool) {
        applyLivekitCredentials(payload);
      }
    },
    [applyLivekitCredentials],
  );

  const applyWaiting = useCallback(
    (payload: WaitingPayload) => {
      // Never downgrade or clobber pool credentials once we know the partner.
      if (matchRef.current) {
        return;
      }
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

  const syncCallState = useCallback(async () => {
    // Already matched with LiveKit up — skip to avoid token churn reconnect loops.
    if (
      matchRef.current?.sessionId &&
      matchRef.current.partnerLivekitIdentity &&
      livekitSessionRef.current?.token
    ) {
      return;
    }

    // HTTP first — ngrok/mobile often drops Socket.IO server→client events.
    try {
      const res = await fetch(apiUrl('/api/match/active'), {
        headers: authHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        const data = (await res.json()) as {
          synced?: boolean;
          call?: MatchedPayload;
        };
        if (data.synced && data.call) {
          applyMatched(data.call, 'Reconnected — resuming your call…');
          return;
        }
      }
    } catch {
      // Fall through to socket ack.
    }

    const socket = socketRef.current ?? getSocket();
    if (!socket.connected) {
      return;
    }
    socket.emit(
      SOCKET_EVENTS.SYNC_CALL,
      {},
      (ack?: { synced?: boolean; call?: MatchedPayload }) => {
        if (ack?.synced && ack.call) {
          applyMatched(ack.call, 'Reconnected — resuming your call…');
        }
      },
    );
  }, [applyMatched]);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    const onConnect = () => {
      setStatusMessage((prev) =>
        prev === 'Ready to start a call.' || phaseRef.current === 'idle'
          ? 'Connected to matching server.'
          : prev,
      );
      // Reconnect / remount — resync if the server already placed us in a call.
      if (!matchRef.current) {
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
      matchRef.current = null;
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
      matchRef.current = null;
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

      // Matched via socket event or ack — HTTP is only a backup for dropped events.
      socket.emit(SOCKET_EVENTS.START_CALL, payload, (ack?: StartCallAck) => {
        if (!ack) return;
        if (ack.status === 'matched' && ack.match) {
          applyMatched(ack.match);
          return;
        }
        if (ack.status === 'waiting' && ack.message) {
          applyWaiting(ack);
        }
      });

      window.setTimeout(() => void syncCallState(), 600);
    };

    if (socket.connected) {
      emitStart();
      return;
    }

    setPhase('connecting');
    setStatusMessage('Connecting to server…');
    socket.connect();
    socket.once('connect', emitStart);
  }, [applyMatched, applyWaiting, syncCallState]);

  const leaveCall = useCallback(() => {
    return new Promise<void>((resolve) => {
      const socket = socketRef.current ?? getSocket();
      let settled = false;

      const finish = () => {
        if (settled) return;
        settled = true;
        matchRef.current = null;
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
  // Key off missing `match`, not phase — LiveKit may already be up (in_call).
  useEffect(() => {
    if (match) {
      return;
    }
    const mightBeInCall =
      phase === 'waiting' ||
      phase === 'connecting' ||
      phase === 'in_call' ||
      phase === 'matched' ||
      // Remount after verify: pool creds exist but React state was reset to idle.
      (phase === 'idle' && livekitSession !== null);
    if (!mightBeInCall) {
      return;
    }

    let cancelled = false;

    const requestSync = () => {
      if (cancelled) return;
      syncCallState();
    };

    requestSync();
    const timer = window.setTimeout(requestSync, 500);
    const interval = window.setInterval(requestSync, 2000);

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
  }, [phase, match, livekitSession, syncCallState]);

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
