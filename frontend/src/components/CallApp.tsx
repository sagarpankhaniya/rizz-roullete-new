import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  Camera,
  Flag,
  Globe,
  Heart,
  MessageCircle,
  Mic,
  MicOff,
  Play,
  Send,
  Settings,
  SwitchCamera,
  Users,
  Video,
  VideoOff,
  X,
} from 'lucide-react';
import { ConnectionState } from 'livekit-client';
import { useNavigate } from 'react-router-dom';
import { consumeCreatorFanWaitingMessage } from '../hooks/useCreatorFanWaiting';
import { useMatching } from '../hooks/useMatching';
import { useLiveKitRoom } from '../hooks/useLiveKitRoom';
import { getSocket } from '../services/socket';
import { COUNTRIES } from '../data/countries';
import type { RoomMode } from './LandingPage';
import { CoinModule } from './CoinModule';
import { CoinWalletChip } from './CoinWalletChip';
import { SubscriptionModal } from './SubscriptionModal';
import { clearCreatorSession } from '../services/creators';
import { UnbanRequestModal } from './UnbanRequestModal';
import { ReportModal } from './ReportModal';
import {
  clearStoredUser,
  getStoredUser,
  isUserSubscribed,
  isUserVip,
  setStoredUser,
  type StoredUser,
} from '../utils/user';
import { updateMatchPreference } from '../services/profile';
import {
  verifyVideoFrame,
  type GenderVerificationResponse,
} from '../services/genderVerification';
import {
  clearBootstrappedCameraRef,
  deviceNeedsCameraGesture,
  discardBootstrappedCamera,
  parkCameraStream,
  takeBootstrappedCamera,
} from '../utils/cameraBootstrap';
import {
  createAgeSession,
  fetchAgeStatus,
  runGoCamAgeVerification,
} from '../services/ageVerification';
import { clearToken } from '../utils/auth';
import {
  CHAT_TRANSLATE_OPTIONS,
  chatTranslatePayload,
  loadChatTranslateLanguage,
  saveChatTranslateLanguage,
} from '../utils/chatTranslation';
import { getCreatorEarnings } from '../services/coins';
import { createPortal } from 'react-dom';
import {
  SOCKET_EVENTS,
  type ChatMessagePayload,
  type TipReceivedPayload,
  type CreatorFanWaitingPayload,
} from '../types/events';

function SearchingDots() {
  return (
    <span className="searching-dots" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

const PREF_OPTIONS = [
  { value: 'everyone', label: '👤 Any Gender' },
  { value: 'male', label: '👨 Male' },
  { value: 'female', label: '💃 Female' },
  { value: 'couple', label: '💑 Couple' },
  { value: 'other', label: '🌈 Other' },
] as const;

type Country = (typeof COUNTRIES)[number];

interface CallAppProps {
  mode?: RoomMode;
  username?: string;
  onLogout?: () => void;
  /** Paid creator room — same call UI, no skip/tag, shows coin module */
  variant?: 'match' | 'creator';
  creatorName?: string;
  onLeaveRoom?: () => void;
  /** Exit creator room → random /match flow */
  onGoToMatch?: () => void;
}

type GenderCheckStatus =
  | 'idle'
  | 'checking'
  | 'age_checking'
  | 'verified'
  | 'mismatch'
  | 'banned'
  | 'retry'
  | 'age_retry'
  | 'needs_camera';

export function CallApp({
  mode = 'moderated',
  username = 'Guest',
  onLogout,
  variant = 'match',
  creatorName = 'Creator',
  onLeaveRoom,
  onGoToMatch,
}: CallAppProps) {
  const isCreatorRoom = variant === 'creator';
  const navigate = useNavigate();
  const {
    phase,
    match,
    livekitSession,
    partnerLivekitIdentity,
    statusMessage,
    startCall,
    leaveCall,
    markInCall,
    markLiveKitError,
    syncCallState,
  } = useMatching(username);

  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);
  const filterPillsRef = useRef<HTMLDivElement | null>(null);
  const autoStartedRef = useRef(false);
  const verificationRunningRef = useRef(false);
  const rematchingRef = useRef(false);
  const searchStartedAtRef = useRef<number | null>(null);

  const [liked, setLiked] = useState(false);
  const [maskOn, setMaskOn] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showNoMatch, setShowNoMatch] = useState(false);
  const [chatDraft, setChatDraft] = useState('');
  const [chatUnread, setChatUnread] = useState(0);
  const [chatMessages, setChatMessages] = useState<
    Array<{
      id: string;
      text: string;
      translatedText?: string;
      from: 'you' | 'partner';
    }>
  >([]);
  const [chatTranslateLang, setChatTranslateLang] = useState(
    loadChatTranslateLanguage,
  );
  const chatMessagesRef = useRef<HTMLDivElement | null>(null);
  const showChatRef = useRef(showChat);
  showChatRef.current = showChat;
  const [hasPreview, setHasPreview] = useState(false);
  const [previewFacing, setPreviewFacing] = useState<'user' | 'environment'>(
    'user',
  );
  const [showSettings, setShowSettings] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [isMobileView, setIsMobileView] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 768px)').matches,
  );
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);
  const [showTipPicker, setShowTipPicker] = useState(false);
  const [showCreatorCoins, setShowCreatorCoins] = useState(false);
  const [showCreatorLeaveModal, setShowCreatorLeaveModal] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(() => isUserSubscribed());
  const [isVip] = useState(() => isUserVip());
  const [pendingPref, setPendingPref] = useState<string | null>(null);
  const [prefUpdating, setPrefUpdating] = useState(false);
  // Live preference — drives matching after PATCH /api/profile/preference
  const [genderPref, setGenderPref] = useState(() => {
    const stored = getStoredUser()?.interestedIn;
    return stored === 'male' ||
      stored === 'female' ||
      stored === 'everyone' ||
      stored === 'couple' ||
      stored === 'other'
      ? stored
      : 'everyone';
  });
  const [countryFilter, setCountryFilter] = useState<Country | null>(null);
  const [countrySearch, setCountrySearch] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [selectedTip, setSelectedTip] = useState<string | null>(null);
  const [customTip, setCustomTip] = useState('');
  const [tipStatus, setTipStatus] = useState('');
  const [tipSending, setTipSending] = useState(false);
  const [genderCheck, setGenderCheck] = useState<{
    status: GenderCheckStatus;
    message: string;
  }>({
    status: 'idle',
    message: 'Preparing your camera for profile verification…',
  });
  const [unbanEmail, setUnbanEmail] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [tipToast, setTipToast] = useState<{
    amount: string;
    creatorReceived?: string;
    fromIdentity: string;
  } | null>(null);
  const [sessionEarnings, setSessionEarnings] = useState(0);
  const [lifetimeEarnings, setLifetimeEarnings] = useState<number | null>(null);
  const [fanWaitingMsg, setFanWaitingMsg] = useState<string | null>(null);

  const stopPreview = useCallback(() => {
    const stream = previewStreamRef.current;
    stream?.getTracks().forEach((t) => t.stop());
    clearBootstrappedCameraRef(stream);
    previewStreamRef.current = null;
    if (previewVideoRef.current) {
      previewVideoRef.current.srcObject = null;
    }
    setHasPreview(false);
  }, []);

  const livekitActive =
    genderCheck.status === 'verified' && Boolean(livekitSession);

  const onLiveKitConnected = useCallback(() => {
    markInCall();
  }, [markInCall]);

  const {
    localVideoRef,
    remoteVideoRef,
    remoteAudioRef,
    connectionState,
    remoteIdentity,
    micEnabled,
    camEnabled,
    toggleMic,
    toggleCam,
    switchCamera,
    disconnect,
    clearRemoteMedia,
    unsubscribePartner,
  } = useLiveKitRoom({
    session: livekitSession,
    partnerLivekitIdentity,
    active: livekitActive,
    onConnected: onLiveKitConnected,
    onError: markLiveKitError,
    onUnpairedRemoteParticipant: syncCallState,
    // Free front cam only in the moment LiveKit needs it
    onBeforeEnableCamera: stopPreview,
  });

  const camEnabledRef = useRef(camEnabled);
  camEnabledRef.current = camEnabled;

  /** Keep / restore local PiP without a black gap (reuses stream when possible). */
  const ensurePreview = useCallback(
    async (options?: { required?: boolean }) => {
      if (!camEnabledRef.current) {
        if (options?.required) {
          throw new Error('Turn on your camera to continue verification.');
        }
        return;
      }
      if (previewStreamRef.current) {
        const track = previewStreamRef.current.getVideoTracks()[0];
        if (track && track.readyState === 'live') {
          if (previewVideoRef.current) {
            const video = previewVideoRef.current;
            video.srcObject = previewStreamRef.current;
            video.muted = true;
            await video.play().catch(() => undefined);
          }
          setHasPreview(true);
          return;
        }
        stopPreview();
      }

      // Prefer stream opened during login/register tap (iOS-safe).
      const bootstrapped = takeBootstrappedCamera();
      if (bootstrapped) {
        const track = bootstrapped.getVideoTracks()[0];
        if (track && track.readyState === 'live') {
          previewStreamRef.current = bootstrapped;
          setPreviewFacing('user');
          setHasPreview(true);
          if (previewVideoRef.current) {
            const video = previewVideoRef.current;
            video.srcObject = bootstrapped;
            video.muted = true;
            await video.play().catch(() => undefined);
          }
          return;
        }
        bootstrapped.getTracks().forEach((t) => t.stop());
      }

      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error(
            'Camera API is unavailable in this browser. Open in Safari/Chrome over HTTPS.',
          );
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'user' },
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });
        previewStreamRef.current = stream;
        setPreviewFacing('user');
        setHasPreview(true);
        if (previewVideoRef.current) {
          const video = previewVideoRef.current;
          video.srcObject = stream;
          video.muted = true;
          // iOS requires an explicit play() after assigning srcObject.
          await video.play().catch(() => undefined);
        }
      } catch (error) {
        setHasPreview(false);
        if (!options?.required) return;
        const name =
          error && typeof error === 'object' && 'name' in error
            ? String((error as { name?: string }).name)
            : '';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          throw new Error(
            'Camera permission denied. Allow camera access for this site, then tap Start Verification.',
          );
        }
        if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          throw new Error('No camera was found on this device.');
        }
        if (name === 'NotReadableError' || name === 'TrackStartError') {
          throw new Error(
            'Camera is busy in another app. Close it, then tap Start Verification.',
          );
        }
        throw new Error(
          error instanceof Error
            ? error.message
            : 'Camera access failed. Tap Start Verification to try again.',
        );
      }
    },
    [stopPreview],
  );

  const verifyProfileAndStart = useCallback(async () => {
    if (verificationRunningRef.current) return;
    verificationRunningRef.current = true;
    setGenderCheck({
      status: 'checking',
      message: 'Checking your profile against the live camera…',
    });

    const markBanned = () => {
      const email = getStoredUser()?.email?.trim() || '';
      clearToken();
      clearStoredUser();
      setUnbanEmail(email || null);
      setGenderCheck({
        status: 'banned',
        message: '',
      });
    };

    try {
      const ageStatus = await fetchAgeStatus();
      if (ageStatus.isBanned) {
        markBanned();
        return;
      }

      await ensurePreview({ required: true });
      const video = previewVideoRef.current;
      if (!video) {
        throw new Error('Camera preview is unavailable.');
      }

      const conclusive: GenderVerificationResponse[] = [];
      let sawMultipleFaces = false;
      let verificationPassed = false;
      let accountBanned = false;
      // Mobile cameras often need a beat after play() before frames are usable.
      await new Promise((resolve) => window.setTimeout(resolve, 250));
      for (let index = 0; index < 3; index += 1) {
        const result = await verifyVideoFrame(video);
        sawMultipleFaces ||= Boolean(result.multipleFaces);
        verificationPassed = result.verificationPassed;
        accountBanned = result.accountBanned;
        if (accountBanned) break;
        if (
          result.matchesProfile !== null &&
          result.confidenceAccepted
        ) {
          conclusive.push(result);
        }
        if (index < 2) {
          await new Promise((resolve) => window.setTimeout(resolve, 400));
        }
      }

      if (accountBanned) {
        markBanned();
        return;
      }

      const matchingFrames = conclusive.filter(
        (result) => result.matchesProfile,
      ).length;
      const mismatchingFrames = conclusive.filter(
        (result) => result.matchesProfile === false,
      ).length;

      if (verificationPassed && matchingFrames >= 2) {
        setGenderCheck({
          status: 'age_checking',
          message: 'Gender matched. Confirming you are 18+…',
        });

        try {
          const session = await createAgeSession();
          if (!session.alreadyVerified) {
            await runGoCamAgeVerification(session);
          }
          setGenderCheck({
            status: 'verified',
            message: isCreatorRoom
              ? `Joining ${creatorName}'s room…`
              : 'Profile and age verified.',
          });
          // Start the no-match clock only after verification finishes —
          // Go.cam age checks often take longer than the 60s search window.
          searchStartedAtRef.current = Date.now();
          startCall();
        } catch (ageError) {
          const code =
            ageError instanceof Error
              ? (ageError as Error & { code?: string }).code
              : undefined;
          if (code === 'USER_BANNED') {
            markBanned();
            return;
          }
          setGenderCheck({
            status: 'age_retry',
            message:
              ageError instanceof Error
                ? ageError.message
                : 'Age verification failed. Please retry.',
          });
        }
        return;
      }

      if (mismatchingFrames >= 2) {
        setGenderCheck({
          status: 'mismatch',
          message: 'The camera result does not match your profile gender.',
        });
        return;
      }

      setGenderCheck({
        status: 'retry',
        message: sawMultipleFaces
          ? 'Only one person may be visible during verification.'
          : 'Keep one face clearly visible in good lighting, then retry.',
      });
    } catch (error) {
      const code =
        error instanceof Error
          ? (error as Error & { code?: string }).code
          : undefined;
      if (code === 'USER_BANNED') {
        markBanned();
        return;
      }
      setGenderCheck({
        status: 'retry',
        message:
          error instanceof Error
            ? error.message
            : 'Gender verification failed. Please retry.',
      });
    } finally {
      verificationRunningRef.current = false;
    }
  }, [creatorName, ensurePreview, isCreatorRoom, startCall]);

  const [partnerFeedReady, setPartnerFeedReady] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);

  const isUnmod = mode === 'unmoderated';
  const isConnected =
    phase === 'in_call' || connectionState === ConnectionState.Connected;
  const isVerifying =
    genderCheck.status === 'idle' ||
    genderCheck.status === 'checking' ||
    genderCheck.status === 'age_checking';
  const needsCameraTap = genderCheck.status === 'needs_camera';
  const verifyFailed =
    genderCheck.status === 'mismatch' ||
    genderCheck.status === 'retry' ||
    genderCheck.status === 'age_retry' ||
    needsCameraTap;
  const isSearching = !isCreatorRoom && (
    isSkipping ||
    isVerifying ||
    verifyFailed ||
    phase === 'waiting' ||
    phase === 'connecting' ||
    phase === 'idle' ||
    phase === 'partner_left'
  );
  const isCreatorWaiting =
    isCreatorRoom &&
    genderCheck.status === 'verified' &&
    !partnerFeedReady &&
    (phase === 'waiting' || phase === 'connecting' || phase === 'matched');
  const showPartnerLoading =
    isVerifying ||
    verifyFailed ||
    (!partnerFeedReady && !(isCreatorRoom && isCreatorWaiting));
  const isConnecting = !isSkipping && phase === 'matched' && !partnerFeedReady;
  const isCreatorPartnerLeft = isCreatorRoom && phase === 'partner_left';
  const showPartnerOverlay =
    showPartnerLoading ||
    isCreatorWaiting ||
    verifyFailed ||
    isCreatorPartnerLeft;
  const videoReady = partnerFeedReady && genderCheck.status === 'verified';
  const partnerLoadingLabel = isVerifying
    ? genderCheck.status === 'age_checking'
      ? 'Confirming age…'
      : 'Verifying…'
    : needsCameraTap
      ? 'Tap to open camera'
      : verifyFailed
        ? genderCheck.status === 'mismatch'
          ? 'Profile mismatch'
          : genderCheck.status === 'age_retry'
            ? 'Age check needed'
            : 'Verification needed'
        : isConnecting
          ? 'Connecting…'
          : 'Searching…';

  // Re-check the live camera every 10s during an active call so a verified
  // profile cannot be swapped for another person after matchmaking starts.
  // Callbacks are read via refs so re-renders (chat, connection flickers, etc.)
  // do not reset the interval and silently skip every tick.
  const clearRemoteMediaRef = useRef(clearRemoteMedia);
  clearRemoteMediaRef.current = clearRemoteMedia;
  const disconnectRef = useRef(disconnect);
  disconnectRef.current = disconnect;
  const leaveCallRef = useRef(leaveCall);
  leaveCallRef.current = leaveCall;

  useEffect(() => {
    if (genderCheck.status !== 'verified') return;
    if (!isConnected) return;

    let cancelled = false;
    let inFlight = false;

    const markBanned = async () => {
      const email = getStoredUser()?.email?.trim() || '';
      clearToken();
      clearStoredUser();
      setUnbanEmail(email || null);
      setGenderCheck({
        status: 'banned',
        message: '',
      });
      clearRemoteMediaRef.current();
      await disconnectRef.current();
      await leaveCallRef.current();
    };

    const pickReadyVideo = () => {
      const candidates = [localVideoRef.current, previewVideoRef.current];
      for (const video of candidates) {
        if (video && video.readyState >= 2 && video.videoWidth > 0) {
          return video;
        }
      }
      return null;
    };

    const tick = async () => {
      if (cancelled || inFlight || !camEnabledRef.current) return;
      const video = pickReadyVideo();
      if (!video) return;

      inFlight = true;
      try {
        const result = await verifyVideoFrame(video, { waitForReady: false });
        if (cancelled) return;
        if (result.accountBanned) {
          await markBanned();
        }
      } catch (error) {
        if (cancelled) return;
        const code =
          error instanceof Error
            ? (error as Error & { code?: string }).code
            : undefined;
        if (code === 'USER_BANNED') {
          await markBanned();
        }
      } finally {
        inFlight = false;
      }
    };

    void tick();
    const intervalId = window.setInterval(() => {
      void tick();
    }, 10_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [genderCheck.status, isConnected, localVideoRef]);

  const hasActiveFilters =
    !!countryFilter || genderPref !== 'everyone' || tags.length > 0;

  const prefLabel =
    PREF_OPTIONS.find((o) => o.value === genderPref)?.label ?? '👤 Any Gender';

  const closeSettings = () => setShowSettings(false);

  const closeChat = () => setShowChat(false);

  const toggleChatPanel = () => {
    setShowChat((open) => {
      if (!open) setChatUnread(0);
      return !open;
    });
  };

  const sendChatMessage = () => {
    const text = chatDraft.trim();
    if (!text || !isConnected) return;
    setChatMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random()}`, text, from: 'you' },
    ]);
    setChatDraft('');
    getSocket().emit(SOCKET_EVENTS.SEND_CHAT, { text });
  };

  const syncChatTranslatePreference = useCallback((code: string) => {
    getSocket().emit(
      SOCKET_EVENTS.SET_CHAT_TRANSLATE,
      chatTranslatePayload(code),
    );
  }, []);

  const onChatTranslateChange = (code: string) => {
    setChatTranslateLang(code);
    saveChatTranslateLanguage(code);
    syncChatTranslatePreference(code);
  };

  useEffect(() => {
    const socket = getSocket();
    const applyPreference = () => syncChatTranslatePreference(chatTranslateLang);
    if (socket.connected) applyPreference();
    socket.on('connect', applyPreference);
    return () => {
      socket.off('connect', applyPreference);
    };
  }, [chatTranslateLang, syncChatTranslatePreference]);

  useEffect(() => {
    if (!isConnected) {
      setChatMessages([]);
      setChatDraft('');
      setChatUnread(0);
    }
  }, [isConnected]);

  useEffect(() => {
    const socket = getSocket();

    const onChatMessage = (payload: ChatMessagePayload) => {
      const text = payload?.text?.trim();
      if (!text) return;
      setChatMessages((prev) => [
        ...prev,
        {
          id: `${payload.sentAt ?? Date.now()}-${Math.random()}`,
          text,
          translatedText: payload.translatedText?.trim() || undefined,
          from: 'partner',
        },
      ]);
      if (!showChatRef.current) {
        setChatUnread((n) => Math.min(n + 1, 99));
      }
    };

    const onTipReceived = (payload: TipReceivedPayload) => {
      const amount = payload?.amount?.trim();
      const fromIdentity = payload?.fromIdentity?.trim() || 'Someone';
      if (!amount) return;
      const gross = Number.parseInt(amount, 10);
      const creditedRaw = Number.parseInt(payload.creatorReceived?.trim() || '', 10);
      const earned =
        Number.isFinite(creditedRaw) && creditedRaw > 0
          ? creditedRaw
          : Number.isFinite(gross)
            ? Math.floor(gross * 0.8)
            : 0;
      if (earned > 0) {
        setSessionEarnings((prev) => prev + earned);
        setLifetimeEarnings((prev) =>
          prev === null ? earned : prev + earned,
        );
      }
      setTipToast({
        amount,
        creatorReceived: payload.creatorReceived,
        fromIdentity,
      });
    };

    const onFanWaiting = (payload: CreatorFanWaitingPayload) => {
      if (!isVip) return;
      const msg =
        payload?.message?.trim() ||
        `${payload?.fanIdentity || 'A fan'} paid to enter your room.`;
      setFanWaitingMsg(msg);
      if (
        genderCheck.status === 'verified' &&
        (phase === 'idle' || phase === 'partner_left' || phase === 'error')
      ) {
        void startCall();
      }
    };

    socket.on(SOCKET_EVENTS.CHAT_MESSAGE, onChatMessage);
    socket.on(SOCKET_EVENTS.TIP_RECEIVED, onTipReceived);
    socket.on(SOCKET_EVENTS.CREATOR_FAN_WAITING, onFanWaiting);
    return () => {
      socket.off(SOCKET_EVENTS.CHAT_MESSAGE, onChatMessage);
      socket.off(SOCKET_EVENTS.TIP_RECEIVED, onTipReceived);
      socket.off(SOCKET_EVENTS.CREATOR_FAN_WAITING, onFanWaiting);
    };
  }, [genderCheck.status, isVip, phase, startCall]);

  useEffect(() => {
    const msg = consumeCreatorFanWaitingMessage();
    if (msg) setFanWaitingMsg(msg);
  }, []);

  useEffect(() => {
    if (!isVip) return;
    getCreatorEarnings().then((data) => {
      if (data) setLifetimeEarnings(data.lifetimeEarnings);
    });
  }, [isVip]);

  useEffect(() => {
    if (phase === 'idle' || phase === 'partner_left') {
      setSessionEarnings(0);
    }
  }, [phase]);

  useEffect(() => {
    if (!fanWaitingMsg) return;
    if (genderCheck.status !== 'verified') return;
    if (phase !== 'idle' && phase !== 'partner_left' && phase !== 'error') return;
    void startCall();
  }, [fanWaitingMsg, genderCheck.status, phase, startCall]);

  useEffect(() => {
    if (!fanWaitingMsg) return;
    const timer = window.setTimeout(() => setFanWaitingMsg(null), 8000);
    return () => window.clearTimeout(timer);
  }, [fanWaitingMsg]);

  useEffect(() => {
    if (!tipToast) return;
    const timer = window.setTimeout(() => setTipToast(null), 5200);
    return () => window.clearTimeout(timer);
  }, [tipToast]);

  useEffect(() => {
    if (!showChat) return;
    chatMessagesRef.current?.scrollTo({
      top: chatMessagesRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [chatMessages, showChat]);

  const openSettings = () => {
    // Desktop uses inline filter pills — settings sheet is mobile-only (matches client)
    if (!isMobileView) return;
    closeTipSheet();
    setShowSettings(true);
  };

  const closeDesktopPickers = () => {
    setShowCountryPicker(false);
    setShowGenderPicker(false);
    setShowTagInput(false);
  };

  const closeTipSheet = () => setShowTipPicker(false);

  const restartSearchWithPref = useCallback(async () => {
    setShowNoMatch(false);
    setIsSkipping(true);
    setPartnerFeedReady(false);
    searchStartedAtRef.current = Date.now();
    unsubscribePartner();
    await leaveCall();
    startCall();
  }, [unsubscribePartner, leaveCall, startCall]);

  const applyPreferenceChange = useCallback(
    async (nextPref: string) => {
      if (prefUpdating || nextPref === genderPref) return;
      setPrefUpdating(true);
      try {
        const result = await updateMatchPreference(nextPref);
        if (!result.ok) {
          if (result.code === 'SUBSCRIPTION_REQUIRED') {
            setPendingPref(nextPref);
            setShowSubscription(true);
            return;
          }
          return;
        }
        setGenderPref(nextPref);
        setStoredUser(result.user);
        setIsSubscribed(Boolean(result.user.isSubscribed));
        setShowGenderPicker(false);
        setShowSettings(false);
        await restartSearchWithPref();
      } finally {
        setPrefUpdating(false);
      }
    },
    [genderPref, prefUpdating, restartSearchWithPref],
  );

  const requestPreferenceChange = useCallback(
    (nextPref: string) => {
      if (nextPref === genderPref || prefUpdating) return;
      const isFreePref =
        nextPref === 'everyone' || nextPref === 'couple' || nextPref === 'other';
      if (!isSubscribed && !isFreePref) {
        setPendingPref(nextPref);
        setShowSettings(false);
        closeDesktopPickers();
        setShowSubscription(true);
        return;
      }
      void applyPreferenceChange(nextPref);
    },
    [applyPreferenceChange, genderPref, isSubscribed, prefUpdating],
  );

  const handleSubscribed = useCallback(
    (user: StoredUser) => {
      setStoredUser(user);
      setIsSubscribed(true);
      const next = pendingPref;
      setPendingPref(null);
      if (next) {
        void applyPreferenceChange(next);
      }
    },
    [applyPreferenceChange, pendingPref],
  );

  const addTag = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !tagInput.trim()) return;
    e.preventDefault();
    const next = tagInput.trim();
    if (!tags.includes(next) && tags.length < 40) {
      setTags([...tags, next]);
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const TIP_PRESETS = [
    { id: '20', label: '$20' },
    { id: '30', label: '$30' },
    { id: '10', label: '$10' },
  ] as const;

  const resolveTipAmount = () => {
    if (selectedTip === 'custom') {
      const raw = customTip.trim();
      if (!raw) return null;
      return raw.startsWith('$') ? raw : `$${raw}`;
    }
    return TIP_PRESETS.find((p) => p.id === selectedTip)?.label ?? null;
  };

  const sendTip = async () => {
    const amount = resolveTipAmount();
    if (!amount) {
      setTipStatus('Choose a tip amount or enter a custom one.');
      return;
    }
    if (!match?.partnerIsVip) {
      setTipStatus('Tips are only for VIP creators.');
      return;
    }
    if (!isConnected) {
      setTipStatus('Connect to a match before tipping.');
      return;
    }

    setTipSending(true);
    setTipStatus('');
    try {
      getSocket().emit(SOCKET_EVENTS.SEND_TIP, { amount });
      setTipStatus(`Tip ${amount} sent to ${match.partnerIdentity}!`);
      setSelectedTip(null);
      setCustomTip('');
    } catch {
      setTipStatus('Could not send tip. Try again.');
    } finally {
      setTipSending(false);
    }
  };

  // Reset feed-ready whenever we leave a room / get a new match
  useEffect(() => {
    setPartnerFeedReady(false);
    setShowTipPicker(false);
    setSelectedTip(null);
    setCustomTip('');
    setTipStatus('');
  }, [match?.sessionId]);

  // Reveal partner video only after the first decoded frame (avoids black → flash).
  // Do not reset feed-ready on brief connection flicker — only on new session.
  useEffect(() => {
    if (!remoteIdentity || !match) {
      return;
    }

    const el = remoteVideoRef.current;
    if (!el) return;

    let cancelled = false;

    const markReady = () => {
      if (cancelled) return;
      if (el.videoWidth > 0 && el.videoHeight > 0) {
        setPartnerFeedReady(true);
      }
    };

    el.addEventListener('loadeddata', markReady);
    el.addEventListener('playing', markReady);
    el.addEventListener('resize', markReady);

    if (el.readyState >= 2 && el.videoWidth > 0) {
      markReady();
    }

    return () => {
      cancelled = true;
      el.removeEventListener('loadeddata', markReady);
      el.removeEventListener('playing', markReady);
      el.removeEventListener('resize', markReady);
    };
  }, [remoteIdentity, match, remoteVideoRef]);

  // Once LiveKit is up, hand PiP back to the live local track
  useEffect(() => {
    if (isConnected) {
      setIsSkipping(false);
    }
  }, [isConnected]);

  // LiveKit pool is up but we never got partner info — ask server to sync call state.
  useEffect(() => {
    if (partnerLivekitIdentity || match) return;
    if (connectionState !== ConnectionState.Connected) return;
    void syncCallState();
  }, [partnerLivekitIdentity, match, connectionState, syncCallState]);

  useEffect(() => {
    if (!isConnected) {
      setShowReportModal(false);
    }
  }, [isConnected]);

  const flipCamera = async () => {
    // Live call: restart the published LiveKit track
    if (isConnected) {
      await switchCamera();
      return;
    }

    const nextFacing = previewFacing === 'user' ? 'environment' : 'user';
    previewStreamRef.current?.getTracks().forEach((t) => t.stop());
    previewStreamRef.current = null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { exact: nextFacing },
        },
        audio: false,
      });
      previewStreamRef.current = stream;
      setPreviewFacing(nextFacing);
      setHasPreview(true);
      if (previewVideoRef.current) {
        previewVideoRef.current.srcObject = stream;
      }
    } catch {
      // Some devices reject `exact` — retry with ideal
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: nextFacing } },
          audio: false,
        });
        previewStreamRef.current = stream;
        setPreviewFacing(nextFacing);
        setHasPreview(true);
        if (previewVideoRef.current) {
          previewVideoRef.current.srcObject = stream;
        }
      } catch {
        // keep previous facing on failure
      }
    }
  };

  // Verify against live camera before matchmaking.
  // Login/register (and the mobile restore gate) open the camera in a tap stack.
  // If that stream is present, auto-start; otherwise prompt for a tap on mobile.
  // Use a cancel flag so React StrictMode's mount→unmount→remount cannot leave a
  // stale `needs_camera` update after the remount already opened the camera.
  useEffect(() => {
    if (autoStartedRef.current) return;
    let cancelled = false;

    void (async () => {
      await ensurePreview();
      if (cancelled) return;
      autoStartedRef.current = true;

      const live = previewStreamRef.current?.getVideoTracks()[0];
      if (live && live.readyState === 'live') {
        void verifyProfileAndStart();
        return;
      }

      if (deviceNeedsCameraGesture()) {
        setGenderCheck({
          status: 'needs_camera',
          message:
            'Tap Start Verification to open your camera and continue.',
        });
        return;
      }

      void verifyProfileAndStart();
    })();

    return () => {
      cancelled = true;
    };
  }, [ensurePreview, verifyProfileAndStart]);

  // Safety net: camera already live but UI stuck on the tap prompt (mobile race).
  useEffect(() => {
    if (genderCheck.status !== 'needs_camera') return;
    const live = previewStreamRef.current?.getVideoTracks()[0];
    if (!hasPreview && !(live && live.readyState === 'live')) return;
    void verifyProfileAndStart();
  }, [genderCheck.status, hasPreview, verifyProfileAndStart]);

  // Matching server rejected start_call — don't leave UI stuck on "Searching…"
  useEffect(() => {
    if (phase !== 'error') return;
    if (genderCheck.status !== 'verified') return;
    setGenderCheck({
      status: 'retry',
      message:
        statusMessage.trim() ||
        'Could not join the match queue. Tap Retry Verification.',
    });
  }, [phase, statusMessage, genderCheck.status]);

  // After 1 minute of searching with no match → show Retry / Log Out modal
  useEffect(() => {
    if (isCreatorRoom) return;
    if (showNoMatch) return;
    if (genderCheck.status !== 'verified') return;

    // Never end an active call — only count time while actually in the queue.
    if (
      phase === 'matched' ||
      phase === 'in_call' ||
      isConnected
    ) {
      searchStartedAtRef.current = null;
      return;
    }

    const searching = phase === 'waiting' || phase === 'connecting';

    if (!searching) return;

    if (searchStartedAtRef.current === null) {
      searchStartedAtRef.current = Date.now();
    }

    const elapsed = Date.now() - searchStartedAtRef.current;
    const remaining = Math.max(0, 60_000 - elapsed);

    const id = window.setTimeout(() => {
      setShowNoMatch(true);
      searchStartedAtRef.current = null;
      void leaveCall();
    }, remaining);

    return () => window.clearTimeout(id);
  }, [
    isCreatorRoom,
    phase,
    showNoMatch,
    leaveCall,
    genderCheck.status,
    isConnected,
  ]);

  // When partner leaves/disconnects, switch subscription and rejoin the queue
  useEffect(() => {
    if (isCreatorRoom) return;
    if (phase !== 'partner_left' || rematchingRef.current || showNoMatch) return;

    let cancelled = false;
    rematchingRef.current = true;
    setIsSkipping(true);
    setPartnerFeedReady(false);
    unsubscribePartner();

    const rematch = async () => {
      try {
        if (cancelled) return;
        startCall();
      } finally {
        rematchingRef.current = false;
      }
    };

    void rematch();

    return () => {
      cancelled = true;
    };
  }, [
    isCreatorRoom,
    phase,
    startCall,
    unsubscribePartner,
    showNoMatch,
  ]);

  // Local PiP while searching / between matches.
  // Keep preview alive until LiveKit actually takes the camera (onBeforeEnableCamera).
  // Do NOT tie this to `match` — that caused a black PiP while finding a partner.
  useEffect(() => {
    if (genderCheck.status !== 'verified') return;
    if (!camEnabled) {
      stopPreview();
      return;
    }
    if (isConnected) {
      // LiveKit owns the camera (including during skip — pool stays connected)
      return;
    }
    void ensurePreview();
  }, [
    camEnabled,
    genderCheck.status,
    isConnected,
    isSkipping,
    ensurePreview,
    stopPreview,
  ]);

  // Park live preview across StrictMode remount; hard-stop only via stopPreview
  // (LiveKit handoff / logout). Leaving the stream running lets remount reclaim it.
  useEffect(
    () => () => {
      const stream = previewStreamRef.current;
      previewStreamRef.current = null;
      if (previewVideoRef.current) {
        previewVideoRef.current.srcObject = null;
      }
      parkCameraStream(stream);
    },
    [],
  );

  useEffect(() => {
    if ((!isConnected || isSkipping) && previewVideoRef.current && previewStreamRef.current) {
      previewVideoRef.current.srcObject = previewStreamRef.current;
    }
  }, [isConnected, isSkipping, hasPreview]);

  useEffect(() => {
    if (!showSettings && !showTipPicker) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeSettings();
        closeTipSheet();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [showSettings, showTipPicker]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const onChange = (e: MediaQueryListEvent) => {
      setIsMobileView(e.matches);
      if (!e.matches) {
        setShowSettings(false);
        closeDesktopPickers();
      }
    };
    setIsMobileView(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!showCountryPicker && !showGenderPicker && !showTagInput) {
      return;
    }

    const onPointerDown = (e: PointerEvent) => {
      if (filterPillsRef.current?.contains(e.target as Node)) return;
      closeDesktopPickers();
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [showCountryPicker, showGenderPicker, showTagInput]);

  const handleLeaveCreatorRoom = async () => {
    await exitCreatorRoom('deck');
  };

  const exitCreatorRoom = async (destination: 'deck' | 'match') => {
    setShowCreatorLeaveModal(false);
    setShowCreatorCoins(false);
    setPartnerFeedReady(false);
    parkCameraStream(previewStreamRef.current);
    previewStreamRef.current = null;
    clearRemoteMedia();
    await disconnect();
    await leaveCall();
    if (destination === 'deck') {
      stopPreview();
      discardBootstrappedCamera();
    }
    clearCreatorSession();
    if (destination === 'deck') {
      onLeaveRoom?.();
    } else {
      onGoToMatch?.();
    }
  };

  useEffect(() => {
    if (!isCreatorPartnerLeft) return;
    setPartnerFeedReady(false);
    setShowCreatorCoins(false);
  }, [isCreatorPartnerLeft]);

  const handleClose = async () => {
    if (isCreatorRoom) {
      setShowCreatorLeaveModal(true);
      return;
    }
    await disconnect();
    await leaveCall();
    stopPreview();
    discardBootstrappedCamera();
    navigate('/match');
  };

  const handleLogout = async () => {
    if (isCreatorRoom) {
      setShowCreatorLeaveModal(true);
      return;
    }
    await disconnect();
    await leaveCall();
    stopPreview();
    discardBootstrappedCamera();
    onLogout?.();
  };

  const handleLeave = async () => {
    setIsSkipping(true);
    setPartnerFeedReady(false);
    setShowNoMatch(false);
    searchStartedAtRef.current = Date.now();
    unsubscribePartner();
    await leaveCall();
    startCall();
  };

  const handleRetryMatch = async () => {
    setShowNoMatch(false);
    setShowChat(false);
    setIsSkipping(true);
    setPartnerFeedReady(false);
    searchStartedAtRef.current = Date.now();
    unsubscribePartner();
    startCall();
  };

  const statusLine = isCreatorRoom
    ? phase === 'partner_left'
      ? `${creatorName} left — choose where to go next`
      : phase === 'waiting'
      ? `Waiting for ${creatorName} to go live on Match…`
      : isVerifying
        ? genderCheck.message
        : verifyFailed
          ? genderCheck.message
          : isConnected
            ? `In ${creatorName}'s room`
            : genderCheck.message || `Joining ${creatorName}'s room…`
    : isVerifying
    ? genderCheck.status === 'age_checking'
      ? `Confirming ${username} is 18+…`
      : `Verifying profile for ${username}…`
    : verifyFailed
      ? genderCheck.message
      : showPartnerLoading
        ? match?.partnerIdentity
          ? `Connecting to ${match.partnerIdentity}…`
          : `Finding ${isUnmod ? 'premium' : 'cute'} match for ${username}…`
        : isConnected
          ? '✨ Connected!'
          : `Welcome, ${username}`;

  const partnerDisplayName = match?.partnerIdentity ?? remoteIdentity;

  const partnerTitle = isCreatorRoom
    ? partnerFeedReady && partnerDisplayName
      ? partnerDisplayName
      : phase === 'waiting'
        ? `Waiting for ${creatorName}…`
        : isConnected
          ? creatorName
          : `Joining ${creatorName}…`
    : partnerFeedReady && partnerDisplayName
      ? partnerDisplayName
      : partnerDisplayName &&
          (phase === 'matched' || phase === 'in_call' || isConnecting)
        ? partnerDisplayName
      : isVerifying
        ? genderCheck.status === 'age_checking'
          ? 'Age verification…'
          : 'Verifying your profile…'
        : needsCameraTap
          ? 'Start verification'
          : verifyFailed
            ? 'Verification paused'
            : isConnecting
              ? 'Connecting…'
            : 'Finding your spark…';

  const partnerSubtitle = isCreatorRoom
    ? partnerFeedReady
      ? 'Live now'
      : phase === 'waiting'
        ? 'Ask her to open Match and search'
        : isConnecting
          ? 'Connecting video…'
          : 'Entering room…'
    : partnerFeedReady
    ? 'Live now'
    : isVerifying
      ? genderCheck.status === 'age_checking'
        ? 'Complete the age check overlay'
        : 'Checking camera…'
      : verifyFailed
        ? genderCheck.message || 'Tap Start Verification to continue'
        : isConnecting
          ? 'Connecting video…'
          : 'Spinning the roulette';

  const filteredCountries = COUNTRIES.filter((c) =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase()),
  );

  return (
    <div
      className={`live-room ${mode}${isCreatorRoom ? ' creator-room' : ''}${isConnected ? ' is-connected' : ''}${showChat ? ' chat-open' : ''}`}
    >
      <header className="live-header">
        <div className="live-header-brand">
          <img src="/assets/landing-bg-4.png" alt="" />
          <span>{isCreatorRoom ? `${creatorName}'s Room` : 'Rizz Roulette'}</span>
          <i className="connection-dot" style={{ opacity: 1 }} />
        </div>
        <div className="live-header-actions">
          <CoinWalletChip variant="compact" className="live-header-coins" />
          <div className="live-header-top-btns">
            {!isCreatorRoom && (
              <button
                type="button"
                className={`mobile-settings-btn${isMobileView && hasActiveFilters ? ' settings-active' : ''}`}
                onClick={openSettings}
                aria-label="Match settings"
              >
                <Settings size={18} />
              </button>
            )}
            <button type="button" onClick={() => void handleLogout()} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>
      </header>

      <div className="live-hero">
        {!isCreatorRoom && (
        <div className="live-hero-skip-row">
          {/* Mobile: always show Skip / Next (desktop-skip is hidden ≤768px) */}
          <button
            className="hot-button mobile-skip-btn"
            type="button"
            onClick={() => void handleLeave()}
            disabled={genderCheck.status !== 'verified'}
            aria-label="Skip to next match"
          >
            <Play size={16} /> Skip / Next
          </button>

          {isConnected ? (
            <button
              className="hot-button desktop-skip-btn"
              type="button"
              onClick={() => void handleLeave()}
              aria-label="Skip to next match"
            >
              <Play size={16} /> Skip / Next
            </button>
          ) : (
            <button className="start-chat desktop-searching-btn" type="button" disabled>
              <Play size={16} />
              <span>
                {isVerifying
                  ? 'Verifying'
                  : verifyFailed
                    ? 'Paused'
                    : 'Searching'}
              </span>
              {!verifyFailed && <SearchingDots />}
            </button>
          )}

          {isConnected && Boolean(match?.partnerUserId) && (
            <button
              type="button"
              className="report-hero-btn"
              onClick={() => {
                setShowReportModal(true);
                setShowTipPicker(false);
                setShowSettings(false);
                closeDesktopPickers();
              }}
              aria-label="Report this user"
            >
              <Flag size={14} /> Report
            </button>
          )}

          {Boolean(match?.partnerIsVip) && !isCreatorRoom && (
            <button
              type="button"
              className={`tip-hero-btn${showTipPicker ? ' active' : ''}`}
              onClick={() => {
                setShowTipPicker((v) => !v);
                setShowSettings(false);
                closeDesktopPickers();
                setTipStatus('');
              }}
              aria-pressed={showTipPicker}
              aria-label="Tip VIP creator"
            >
              💸 Tip
            </button>
          )}
        </div>
        )}
        {isCreatorRoom && isConnected && Boolean(match?.partnerUserId) && (
          <div className="live-hero-skip-row creator-room-hero-actions">
            <button
              type="button"
              className="report-hero-btn"
              onClick={() => {
                setShowReportModal(true);
                setShowTipPicker(false);
                setShowSettings(false);
                closeDesktopPickers();
              }}
              aria-label="Report this user"
            >
              <Flag size={14} /> Report
            </button>
          </div>
        )}
        {isVip && isConnected && (
          <div className="creator-earnings-strip" aria-live="polite">
            <span>
              This call: <b>{sessionEarnings.toLocaleString()}</b> coins
            </span>
            {lifetimeEarnings !== null && (
              <span>
                Lifetime: <b>{lifetimeEarnings.toLocaleString()}</b> coins
              </span>
            )}
          </div>
        )}
        <p>{statusLine}</p>
      </div>

      <main className="video-stage">
        <section
          className={`partner-video${videoReady ? ' video-ready' : ''}${isConnected ? ' is-connected' : ''}${showPartnerLoading ? ' is-loading' : ''}${isSearching ? ' is-searching' : ''}${isCreatorWaiting ? ' creator-waiting' : ''}${isCreatorRoom && showCreatorCoins ? ' coins-open' : ''}${verifyFailed ? ' verify-failed' : ''}`}
          aria-label="Partner video"
        >
          <div className="partner-photo" aria-hidden="true" />
          <video
            ref={remoteVideoRef}
            className="partner-feed"
            autoPlay
            playsInline
          />
          <audio ref={remoteAudioRef} autoPlay />
          {/* Always mounted so skip never flashes black / empty without the heart */}
          <div
            className={`partner-loading-layer${showPartnerOverlay ? ' is-visible' : ''}${verifyFailed || isCreatorPartnerLeft ? ' has-actions' : ''}${isCreatorWaiting ? ' creator-waiting-layer' : ''}`}
            aria-hidden={!showPartnerOverlay}
          >
            <div className="partner-loading-shimmer" />
            <div className="live-partner-placeholder">
              {isUnmod ? '🎲' : '💘'}
            </div>
            {showPartnerLoading && !verifyFailed && !isCreatorWaiting && (
              <span className="partner-loading-label">
                {partnerLoadingLabel}
              </span>
            )}
            {isCreatorWaiting && (
              <div className="partner-verify-actions creator-wait-panel">
                <strong className="partner-verify-title">Waiting for {creatorName}</strong>
                <p className="partner-verify-message">
                  Your camera stays on. She must open <strong>Match</strong> and tap search to connect.
                </p>
                <div className="partner-verify-buttons">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => void handleLeaveCreatorRoom()}
                  >
                    Back to deck
                  </button>
                </div>
              </div>
            )}
            {isCreatorPartnerLeft && (
              <div className="partner-verify-actions creator-exit-panel">
                <strong className="partner-verify-title">{creatorName} left the room</strong>
                <p className="partner-verify-message">
                  Choose where to go next — browse other creators or jump back to random chat.
                </p>
                <div className="partner-verify-buttons">
                  <button
                    type="button"
                    className="hot-button"
                    onClick={() => void exitCreatorRoom('deck')}
                  >
                    Back to deck
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => void exitCreatorRoom('match')}
                  >
                    Random match
                  </button>
                </div>
              </div>
            )}
            {verifyFailed && (
              <div className="partner-verify-actions">
                <strong className="partner-verify-title">
                  {needsCameraTap ? 'Start verification' : 'Verification paused'}
                </strong>
                {genderCheck.message ? (
                  <p className="partner-verify-message">{genderCheck.message}</p>
                ) : null}
                <div className="partner-verify-buttons">
                  <button
                    type="button"
                    className="hot-button"
                    onClick={() => void verifyProfileAndStart()}
                  >
                    {needsCameraTap ? 'Start Verification' : 'Retry Verification'}
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => void (isCreatorRoom ? handleLeaveCreatorRoom() : handleClose())}
                  >
                    {isCreatorRoom ? 'Back to deck' : 'Back'}
                  </button>
                </div>
              </div>
            )}
          </div>
          <span className="video-label">Partner</span>
          {Boolean(match?.partnerIsVip) && !isCreatorRoom && (
            <span className="video-label vip-badge partner-vip-badge">VIP</span>
          )}

          {!isCreatorRoom && (
          <div className="filter-pills desktop-filter-pills" ref={filterPillsRef}>
            <div className="filter-pill-wrap">
              <button
                type="button"
                className={countryFilter ? 'active' : ''}
                onClick={() => {
                  setShowCountryPicker((v) => !v);
                  setShowGenderPicker(false);
                  setShowTagInput(false);
                  setShowTipPicker(false);
                  setCountrySearch('');
                }}
              >
                {countryFilter
                  ? `${countryFilter.flag} ${countryFilter.name}`
                  : '🌍 Any Country'}
              </button>
              {showCountryPicker && (
                <div className="country-dropdown">
                  <input
                    type="text"
                    placeholder="Search country…"
                    value={countrySearch}
                    onChange={(e) => setCountrySearch(e.target.value)}
                    autoFocus
                  />
                  <div className="country-list">
                    <button
                      type="button"
                      className={!countryFilter ? 'sel' : ''}
                      onClick={() => {
                        setCountryFilter(null);
                        closeDesktopPickers();
                      }}
                    >
                      🌍 Any Country
                    </button>
                    {filteredCountries.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        className={countryFilter?.code === c.code ? 'sel' : ''}
                        onClick={() => {
                          setCountryFilter(c);
                          closeDesktopPickers();
                        }}
                      >
                        {c.flag} {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="filter-pill-wrap">
              <button
                type="button"
                className={genderPref !== 'everyone' ? 'active' : ''}
                onClick={() => {
                  setShowGenderPicker((v) => !v);
                  setShowCountryPicker(false);
                  setShowTagInput(false);
                  setShowTipPicker(false);
                }}
              >
                {prefLabel}
              </button>
              {showGenderPicker && (
                <div className="country-dropdown gender-dropdown">
                  <div className="country-list">
                    {PREF_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={genderPref === opt.value ? 'sel' : ''}
                        onClick={() => requestPreferenceChange(opt.value)}
                        disabled={prefUpdating}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="filter-pill-wrap">
              <button
                type="button"
                className={tags.length > 0 ? 'active' : ''}
                onClick={() => {
                  setShowTagInput((v) => !v);
                  setShowCountryPicker(false);
                  setShowGenderPicker(false);
                  setShowTipPicker(false);
                }}
              >
                {tags.length > 0
                  ? `💕 ${tags.length} tag${tags.length > 1 ? 's' : ''}`
                  : '💕 Add Tags'}
              </button>
              {showTagInput && (
                <div className="country-dropdown tag-dropdown">
                  <input
                    type="text"
                    placeholder="Type a tag & press Enter…"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={addTag}
                    autoFocus
                  />
                  <div className="tag-list">
                    {tags.length === 0 && (
                      <p className="tag-hint">
                        Add up to 40 interest tags like &quot;Flirty&quot;, &quot;Gaming&quot;,
                        &quot;Music&quot;, &quot;Travel&quot;…
                      </p>
                    )}
                    {tags.map((t) => (
                      <span key={t} className="tag-chip">
                        {t}
                        <button
                          type="button"
                          onClick={() => removeTag(t)}
                          aria-label={`Remove ${t}`}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
          )}

          {isCreatorRoom && showCreatorCoins && (
            <CoinModule
              partnerIdentity={creatorName}
              tipsEnabled={isConnected && partnerFeedReady}
            />
          )}

          {!(isCreatorRoom && showCreatorCoins) && (
          <div className="partner-copy">
            <strong>{partnerTitle}</strong>
            <span>{partnerSubtitle}</span>
          </div>
          )}
        </section>

        <section
          className={`self-video ${maskOn ? 'mask-on' : ''} ${!camEnabled ? 'cam-off' : ''}`}
          aria-label="Your video preview"
        >
          <button
            type="button"
            className={`self-video-flip${!camEnabled ? ' media-off' : ''}`}
            onClick={() => void flipCamera()}
            disabled={!hasPreview && !isConnected}
            aria-label="Switch between front and back camera"
          >
            <SwitchCamera size={18} />
          </button>
          <Camera
            size={32}
            style={{
              opacity:
                (isConnected || hasPreview) && camEnabled ? 0 : 0.5,
              zIndex: 1,
            }}
          />
          {/* Preview stays mounted so skip/search never blanks the PiP */}
          <video
            ref={previewVideoRef}
            autoPlay
            muted
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              position: 'absolute',
              top: 0,
              left: 0,
              borderRadius: '20px',
              zIndex: camEnabled && hasPreview && !isConnected ? 10 : -1,
              opacity: camEnabled && hasPreview && !isConnected ? 1 : 0,
            }}
          />
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              position: 'absolute',
              top: 0,
              left: 0,
              borderRadius: '20px',
              zIndex: camEnabled && isConnected ? 10 : -1,
              opacity: camEnabled && isConnected ? 1 : 0,
            }}
          />
          {!needsCameraTap &&
            ((!isConnected && (!hasPreview || !camEnabled)) ||
              (isConnected && !camEnabled)) && (
              <span className="live-self-label">
                {camEnabled ? 'Your Camera' : 'Camera Off'}
              </span>
            )}
          {maskOn && <span className="video-label mask-badge">🎭 VR</span>}
          {isVip && <span className="video-label vip-badge">VIP</span>}
          <b className="video-label you">You</b>
        </section>
      </main>

      <nav className="bottom-controls" aria-label="Matching controls">
        <button
          type="button"
          className={`bottom-control-item chat-control${showChat ? ' active' : ''}`}
          onClick={toggleChatPanel}
          aria-pressed={showChat}
          aria-label={showChat ? 'Close chat' : 'Open chat'}
        >
          <span className="chat-control-icon">
            <MessageCircle size={22} />
            {chatUnread > 0 && !showChat && (
              <span className="chat-unread-badge">{chatUnread}</span>
            )}
          </span>
          <span className="control-label">Chat</span>
        </button>
        <button
          type="button"
          className={`bottom-control-item${maskOn ? ' vr-active' : ''}`}
          onClick={() => setMaskOn((v) => !v)}
        >
          <span className="control-icon" aria-hidden="true">
            🎭
          </span>
          <span className="control-label control-label-short">
            {maskOn ? 'On' : 'Mask'}
          </span>
          <span className="control-label control-label-full">
            {maskOn ? 'Mask ON' : 'VR Mask'}
          </span>
        </button>
        <button
          type="button"
          className={`bottom-control-item${liked ? ' active' : ''}`}
          onClick={() => setLiked((v) => !v)}
        >
          <Heart size={22} />
          <span className="control-label">{liked ? 'Liked' : 'Like'}</span>
        </button>
        {isCreatorRoom && (
          <button
            type="button"
            className={`bottom-control-item tip-control${showCreatorCoins ? ' active' : ''}`}
            onClick={() => {
              setShowCreatorCoins((v) => {
                const next = !v;
                if (next) setShowChat(false);
                return next;
              });
            }}
            aria-pressed={showCreatorCoins}
            aria-label={showCreatorCoins ? 'Hide tips and coins' : 'Show tips and coins'}
          >
            <span className="control-icon" aria-hidden="true">
              🪙
            </span>
            <span className="control-label">Tips</span>
          </button>
        )}
        <button
          type="button"
          className={`bottom-control-item${!micEnabled ? ' media-off' : ''}`}
          onClick={() => void toggleMic()}
          aria-pressed={!micEnabled}
        >
          {micEnabled ? <Mic size={22} /> : <MicOff size={22} />}
          <span className="control-label">{micEnabled ? 'Mic' : 'Mute'}</span>
        </button>
        <button
          type="button"
          className={`bottom-control-item cam-toggle${!camEnabled ? ' media-off' : ''}`}
          onClick={() => void toggleCam()}
          aria-pressed={!camEnabled}
        >
          {camEnabled ? <Video size={22} /> : <VideoOff size={22} />}
          <span className="control-label">{camEnabled ? 'Cam' : 'Cam Off'}</span>
        </button>
      </nav>

      <aside
        className={`chat-panel${showChat ? ' open' : ''}`}
        aria-hidden={!showChat}
        aria-label="Chat"
      >
        <div className="chat-panel-header">
          <span>Chat</span>
          <div className="chat-translate-wrap">
            <Globe size={14} aria-hidden="true" />
            <select
              className="chat-translate-select"
              value={chatTranslateLang}
              onChange={(e) => onChatTranslateChange(e.target.value)}
              aria-label="Translate incoming messages to"
            >
              {CHAT_TRANSLATE_OPTIONS.map((opt) => (
                <option key={opt.value || 'off'} value={opt.value}>
                  {opt.value ? opt.label : 'Translate: Off'}
                </option>
              ))}
            </select>
          </div>
          <button type="button" onClick={closeChat} aria-label="Close chat">
            <X size={16} />
          </button>
        </div>

        <div className="chat-messages" ref={chatMessagesRef}>
          {chatMessages.length === 0 ? (
            <p className="chat-empty">
              {isConnected
                ? 'Say hi — messages stay in this call only.'
                : 'Chat unlocks once you’re matched.'}
            </p>
          ) : (
            chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`chat-msg ${msg.from === 'you' ? 'you' : 'partner'}`}
              >
                <span className="chat-msg-text">{msg.text}</span>
                {msg.translatedText && msg.translatedText !== msg.text && (
                  <span className="chat-msg-translation">{msg.translatedText}</span>
                )}
              </div>
            ))
          )}
        </div>

        <form
          className="chat-input-bar"
          onSubmit={(e) => {
            e.preventDefault();
            sendChatMessage();
          }}
        >
          <input
            type="text"
            value={chatDraft}
            onChange={(e) => setChatDraft(e.target.value)}
            placeholder={
              isConnected ? 'Type a message…' : 'Waiting for match...'
            }
            disabled={!isConnected}
            maxLength={500}
            aria-label="Chat message"
          />
          <button
            type="submit"
            disabled={!isConnected || !chatDraft.trim()}
            aria-label="Send message"
          >
            <Send size={18} />
          </button>
        </form>
      </aside>

      {showSettings && isMobileView && !isCreatorRoom && (
        <div
          className="live-settings-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="live-settings-title"
          onClick={closeSettings}
        >
          <div
            className="live-settings-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="live-settings-head">
              <h3 id="live-settings-title">Match Settings</h3>
              <button type="button" onClick={closeSettings} aria-label="Close settings">
                <X size={20} />
              </button>
            </div>

            <section className="live-settings-section">
              <h4>Country</h4>
              <input
                type="text"
                className="live-settings-input"
                placeholder="Search country…"
                value={countrySearch}
                onChange={(e) => setCountrySearch(e.target.value)}
              />
              <div className="country-list live-settings-list">
                <button
                  type="button"
                  className={!countryFilter ? 'sel' : ''}
                  onClick={() => {
                    setCountryFilter(null);
                    setCountrySearch('');
                  }}
                >
                  🌍 Any Country
                </button>
                {filteredCountries.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    className={countryFilter?.code === c.code ? 'sel' : ''}
                    onClick={() => {
                      setCountryFilter(c);
                      setCountrySearch('');
                    }}
                  >
                    {c.flag} {c.name}
                  </button>
                ))}
              </div>
            </section>

            <section className="live-settings-section">
              <h4>Match Preference</h4>
              <p className="live-settings-current">{prefLabel}</p>
              <div className="live-settings-options">
                {PREF_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={genderPref === opt.value ? 'sel' : ''}
                    onClick={() => requestPreferenceChange(opt.value)}
                    disabled={prefUpdating}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="live-settings-section">
              <h4>Interest Tags</h4>
              <input
                type="text"
                className="live-settings-input"
                placeholder="Type a tag & press Enter…"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={addTag}
              />
              <div className="tag-list live-settings-tags">
                {tags.length === 0 && (
                  <p className="tag-hint">
                    Add up to 40 interest tags like &quot;Flirty&quot;, &quot;Gaming&quot;,
                    &quot;Music&quot;, &quot;Travel&quot;…
                  </p>
                )}
                {tags.map((t) => (
                  <span key={t} className="tag-chip">
                    {t}
                    <button
                      type="button"
                      onClick={() => removeTag(t)}
                      aria-label={`Remove ${t}`}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}

      {showTipPicker && Boolean(match?.partnerIsVip) && !isCreatorRoom && (
        <div
          className="live-settings-overlay tip-sheet-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tip-sheet-title"
          onClick={() => setShowTipPicker(false)}
        >
          <div
            className="live-settings-panel tip-sheet-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="live-settings-head">
              <h3 id="tip-sheet-title">Tip Creator</h3>
              <button
                type="button"
                onClick={() => setShowTipPicker(false)}
                aria-label="Close tip"
              >
                <X size={20} />
              </button>
            </div>
            <p className="live-settings-current">
              Tip VIP {match?.partnerIdentity || 'creator'}
            </p>
            <div className="live-settings-options tip-options tip-sheet-options">
              {TIP_PRESETS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={selectedTip === opt.id ? 'sel' : ''}
                  onClick={() => {
                    setSelectedTip(opt.id);
                    setCustomTip('');
                    setTipStatus('');
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              className="live-settings-input"
              inputMode="decimal"
              placeholder="Custom amount…"
              value={customTip}
              onChange={(e) => {
                setCustomTip(e.target.value);
                setSelectedTip('custom');
                setTipStatus('');
              }}
            />
            <button
              type="button"
              className="tip-send-btn tip-sheet-send"
              onClick={() => void sendTip()}
              disabled={tipSending}
            >
              {tipSending ? 'Sending…' : 'Send Tip'}
            </button>
            {tipStatus && <p className="tip-status tip-sheet-status">{tipStatus}</p>}
          </div>
        </div>
      )}
      {genderCheck.status === 'banned' &&
        (unbanEmail
          ? createPortal(
              <UnbanRequestModal
                email={unbanEmail}
                mode={mode}
                onClose={() => void handleLogout()}
              />,
              document.body,
            )
          : (
            <div className="live-room-overlay" role="dialog" aria-modal="true">
              <div className="live-room-overlay-card">
                <h3>Account Restricted</h3>
                <p>Please log in again to request an unban.</p>
                <div className="flow-actions">
                  <button
                    type="button"
                    className="hot-button"
                    onClick={() => void handleLogout()}
                  >
                    Log Out
                  </button>
                </div>
              </div>
            </div>
          ))}
      {showCreatorLeaveModal && isCreatorRoom && (
        <div
          className="live-room-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="creator-leave-title"
        >
          <div className="live-room-overlay-card">
            <div className="live-room-overlay-icon" aria-hidden="true">
              💘
            </div>
            <h3 id="creator-leave-title">Leave {creatorName}&apos;s room?</h3>
            <p>Go back to the creator deck or return to random match chat.</p>
            <div className="flow-actions">
              <button
                type="button"
                className="hot-button"
                onClick={() => void exitCreatorRoom('deck')}
              >
                Back to deck
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => void exitCreatorRoom('match')}
              >
                Random match
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setShowCreatorLeaveModal(false)}
              >
                Stay in room
              </button>
            </div>
          </div>
        </div>
      )}

      {showNoMatch && (
        <div
          className="live-room-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="no-match-title"
        >
          <div className="live-room-overlay-card">
            <div className="live-room-overlay-icon" aria-hidden="true">
              <Users size={42} strokeWidth={1.75} />
            </div>
            <h3 id="no-match-title">No Matches Found</h3>
            <p>
              It seems everyone is currently matched or offline. Try searching
              again!
            </p>
            <div className="flow-actions">
              <button
                type="button"
                className="hot-button"
                onClick={() => void handleRetryMatch()}
              >
                Retry
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => void handleLogout()}
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
      {showSubscription && (
        <SubscriptionModal
          mode={mode}
          onClose={() => {
            setShowSubscription(false);
            setPendingPref(null);
          }}
          onSubscribed={handleSubscribed}
          onBackToLanding={() => {
            setShowSubscription(false);
            setPendingPref(null);
            void handleClose();
          }}
        />
      )}

      {fanWaitingMsg && (
        <div className="tip-toast fan-waiting-toast" role="status" aria-live="polite">
          <div className="tip-toast-glow" aria-hidden="true" />
          <div className="tip-toast-icon" aria-hidden="true">
            🔔
          </div>
          <div className="tip-toast-copy">
            <strong>Fan waiting in your room</strong>
            <span>{fanWaitingMsg}</span>
          </div>
          <button
            type="button"
            className="tip-toast-close"
            onClick={() => setFanWaitingMsg(null)}
            aria-label="Dismiss notification"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {tipToast && (
        <div className="tip-toast" role="status" aria-live="polite">
          <div className="tip-toast-glow" aria-hidden="true" />
          <div className="tip-toast-icon" aria-hidden="true">
            💸
          </div>
          <div className="tip-toast-copy">
            <strong>New tip received!</strong>
            <span>
              <b>{tipToast.fromIdentity}</b> sent{' '}
              <em>{tipToast.amount}</em>
              {tipToast.creatorReceived && (
                <>
                  {' '}
                  — you earned <em>{tipToast.creatorReceived}</em> coins
                </>
              )}
            </span>
          </div>
          <button
            type="button"
            className="tip-toast-close"
            onClick={() => setTipToast(null)}
            aria-label="Dismiss tip notification"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {showReportModal &&
        match?.partnerUserId &&
        createPortal(
          <ReportModal
            partnerName={match.partnerIdentity || remoteIdentity || 'partner'}
            partnerUserId={match.partnerUserId}
            roomName={match.sessionId}
            onClose={() => setShowReportModal(false)}
            onSubmitted={() => {
              setShowReportModal(false);
              void handleLeave();
            }}
          />,
          document.body,
        )}
    </div>
  );
}
