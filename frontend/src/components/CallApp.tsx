import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  Camera,
  Crown,
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
import { useMatching } from '../hooks/useMatching';
import { useLiveKitRoom } from '../hooks/useLiveKitRoom';
import { getSocket } from '../services/socket';
import { COUNTRIES } from '../data/countries';
import type { RoomMode } from './LandingPage';
import { SubscriptionModal } from './SubscriptionModal';
import { getStoredUser, isUserSubscribed, isUserVip, setStoredUser } from '../utils/user';
import { updateMatchPreference } from '../services/profile';
import type { StoredUser } from '../utils/user';
import {
  SOCKET_EVENTS,
  type ChatMessagePayload,
  type TipReceivedPayload,
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
  onClose?: () => void;
  onLogout?: () => void;
}

export function CallApp({
  mode = 'moderated',
  username = 'Guest',
  onClose,
  onLogout,
}: CallAppProps) {
  const {
    phase,
    match,
    startCall,
    leaveCall,
    markInCall,
    markLiveKitError,
  } = useMatching(username);

  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);
  const filterPillsRef = useRef<HTMLDivElement | null>(null);
  const autoStartedRef = useRef(false);
  const rematchingRef = useRef(false);
  const searchStartedAtRef = useRef<number | null>(null);

  const [liked, setLiked] = useState(false);
  const [maskOn, setMaskOn] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showNoMatch, setShowNoMatch] = useState(false);
  const [chatDraft, setChatDraft] = useState('');
  const [chatUnread, setChatUnread] = useState(0);
  const [chatMessages, setChatMessages] = useState<
    Array<{ id: string; text: string; from: 'you' | 'partner' }>
  >([]);
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
  const [tipToast, setTipToast] = useState<{
    amount: string;
    fromIdentity: string;
  } | null>(null);

  const stopPreview = useCallback(() => {
    previewStreamRef.current?.getTracks().forEach((t) => t.stop());
    previewStreamRef.current = null;
    if (previewVideoRef.current) {
      previewVideoRef.current.srcObject = null;
    }
    setHasPreview(false);
  }, []);

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
  } = useLiveKitRoom({
    match,
    onConnected: markInCall,
    onError: markLiveKitError,
    // Free front cam only in the moment LiveKit needs it
    onBeforeEnableCamera: stopPreview,
  });

  const camEnabledRef = useRef(camEnabled);
  camEnabledRef.current = camEnabled;

  /** Keep / restore local PiP without a black gap (reuses stream when possible). */
  const ensurePreview = useCallback(async () => {
    if (!camEnabledRef.current) return;
    if (previewStreamRef.current) {
      const track = previewStreamRef.current.getVideoTracks()[0];
      if (track && track.readyState === 'live') {
        if (previewVideoRef.current) {
          previewVideoRef.current.srcObject = previewStreamRef.current;
        }
        setHasPreview(true);
        return;
      }
      stopPreview();
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'user' } },
        audio: false,
      });
      previewStreamRef.current = stream;
      setPreviewFacing('user');
      setHasPreview(true);
      if (previewVideoRef.current) {
        previewVideoRef.current.srcObject = stream;
      }
    } catch {
      setHasPreview(false);
    }
  }, [stopPreview]);

  const [partnerFeedReady, setPartnerFeedReady] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);

  const isUnmod = mode === 'unmoderated';
  const isConnected =
    phase === 'in_call' || connectionState === ConnectionState.Connected;
  const isSearching =
    isSkipping ||
    phase === 'waiting' ||
    phase === 'connecting' ||
    phase === 'idle' ||
    phase === 'partner_left';
  const isConnecting = !isSkipping && phase === 'matched' && !partnerFeedReady;
  // Keep heart loader until the new partner's first video frame is painted
  const showPartnerLoading = !partnerFeedReady;
  const videoReady = partnerFeedReady;

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
      setTipToast({ amount, fromIdentity });
    };

    socket.on(SOCKET_EVENTS.CHAT_MESSAGE, onChatMessage);
    socket.on(SOCKET_EVENTS.TIP_RECEIVED, onTipReceived);
    return () => {
      socket.off(SOCKET_EVENTS.CHAT_MESSAGE, onChatMessage);
      socket.off(SOCKET_EVENTS.TIP_RECEIVED, onTipReceived);
    };
  }, []);

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
    if (isMobileView) setShowSettings(true);
  };

  const closeDesktopPickers = () => {
    setShowCountryPicker(false);
    setShowGenderPicker(false);
    setShowTagInput(false);
    setShowTipPicker(false);
  };

  const openSubscription = () => {
    setShowSettings(false);
    closeDesktopPickers();
    setShowSubscription(true);
  };

  const restartSearchWithPref = useCallback(async () => {
    setShowNoMatch(false);
    setIsSkipping(true);
    setPartnerFeedReady(false);
    searchStartedAtRef.current = Date.now();
    clearRemoteMedia();
    await disconnect();
    await ensurePreview();
    await leaveCall();
    startCall();
  }, [clearRemoteMedia, disconnect, ensurePreview, leaveCall, startCall]);

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
      if (!isSubscribed) {
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
  }, [match?.roomName]);

  // Reveal partner video only after the first decoded frame (avoids black → flash)
  useEffect(() => {
    if (!isConnected || !remoteIdentity || !match) {
      setPartnerFeedReady(false);
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

    // Already playing (e.g. track attached before listeners)
    if (el.readyState >= 2 && el.videoWidth > 0) {
      markReady();
    }

    return () => {
      cancelled = true;
      el.removeEventListener('loadeddata', markReady);
      el.removeEventListener('playing', markReady);
      el.removeEventListener('resize', markReady);
    };
  }, [isConnected, remoteIdentity, match, remoteVideoRef]);

  // Once LiveKit is up, hand PiP back to the live local track
  useEffect(() => {
    if (isConnected) {
      setIsSkipping(false);
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

  // Auto-start matching as soon as this page loads
  useEffect(() => {
    if (autoStartedRef.current) return;
    autoStartedRef.current = true;
    searchStartedAtRef.current = Date.now();
    startCall();
  }, [startCall]);

  // After 1 minute of searching with no match → show Retry / Log Out modal
  useEffect(() => {
    if (showNoMatch) return;

    if (phase === 'matched' || phase === 'in_call') {
      searchStartedAtRef.current = null;
      return;
    }

    const searching =
      phase === 'waiting' ||
      phase === 'connecting' ||
      phase === 'partner_left' ||
      phase === 'idle';

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
  }, [phase, showNoMatch, leaveCall]);

  // When partner leaves/disconnects, tear down LiveKit and rejoin the queue
  useEffect(() => {
    if (phase !== 'partner_left' || rematchingRef.current || showNoMatch) return;

    let cancelled = false;
    rematchingRef.current = true;
    setIsSkipping(true);
    setPartnerFeedReady(false);
    clearRemoteMedia();

    const rematch = async () => {
      try {
        await disconnect();
        if (cancelled) return;
        await ensurePreview();
        startCall();
      } finally {
        rematchingRef.current = false;
      }
    };

    void rematch();

    return () => {
      cancelled = true;
    };
  }, [phase, disconnect, startCall, clearRemoteMedia, ensurePreview, showNoMatch]);

  // Local PiP while searching / between matches.
  // Keep preview alive until LiveKit actually takes the camera (onBeforeEnableCamera).
  // Do NOT tie this to `match` — that caused a black PiP while finding a partner.
  useEffect(() => {
    if (!camEnabled) {
      stopPreview();
      return;
    }
    if (isConnected && !isSkipping) {
      // LiveKit owns the camera; preview already stopped in onBeforeEnableCamera
      return;
    }
    void ensurePreview();
  }, [camEnabled, isConnected, isSkipping, ensurePreview, stopPreview]);

  // Release preview tracks only on unmount
  useEffect(() => () => stopPreview(), [stopPreview]);

  useEffect(() => {
    if ((!isConnected || isSkipping) && previewVideoRef.current && previewStreamRef.current) {
      previewVideoRef.current.srcObject = previewStreamRef.current;
    }
  }, [isConnected, isSkipping, hasPreview]);

  useEffect(() => {
    if (!showSettings) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSettings();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [showSettings]);

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
    if (
      !showCountryPicker &&
      !showGenderPicker &&
      !showTagInput &&
      !showTipPicker
    ) {
      return;
    }

    const onPointerDown = (e: PointerEvent) => {
      if (filterPillsRef.current?.contains(e.target as Node)) return;
      closeDesktopPickers();
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [showCountryPicker, showGenderPicker, showTagInput, showTipPicker]);

  const handleClose = async () => {
    await disconnect();
    await leaveCall();
    onClose?.();
  };

  const handleLogout = async () => {
    await disconnect();
    await leaveCall();
    onLogout?.();
  };

  const handleLeave = async () => {
    // Instantly lock UI on the heart loader — no black flash / stale partner frame
    setIsSkipping(true);
    setPartnerFeedReady(false);
    setShowNoMatch(false);
    searchStartedAtRef.current = Date.now();
    clearRemoteMedia();
    await disconnect();
    await ensurePreview(); // restore local PiP before queueing again
    await leaveCall();
    startCall();
  };

  const handleRetryMatch = async () => {
    setShowNoMatch(false);
    setShowChat(false);
    setIsSkipping(true);
    setPartnerFeedReady(false);
    searchStartedAtRef.current = Date.now();
    clearRemoteMedia();
    await disconnect();
    await ensurePreview();
    startCall();
  };

  const statusLine = showPartnerLoading
    ? `Finding ${isUnmod ? 'premium' : 'cute'} match for ${username}…`
    : isConnected
      ? '✨ Connected!'
      : `Welcome, ${username}`;

  const partnerTitle =
    partnerFeedReady && remoteIdentity
      ? remoteIdentity
      : 'Finding your spark…';

  const partnerSubtitle = partnerFeedReady
    ? 'Live now'
    : isConnecting
      ? 'Connecting video…'
      : 'Spinning the roulette';

  const filteredCountries = COUNTRIES.filter((c) =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase()),
  );

  return (
    <div
      className={`live-room ${mode}${isConnected ? ' is-connected' : ''}${showChat ? ' chat-open' : ''}`}
    >
      <header className="live-header">
        <div>
          <img src="/assets/landing-bg-4.png" alt="" />
          <span>Rizz Roulette</span>
          <i className="connection-dot" style={{ opacity: 1 }} />
        </div>
        <div className="live-header-actions">
          <div className="live-header-top-btns">
            <button
              type="button"
              className={`mobile-settings-btn${isMobileView && hasActiveFilters ? ' settings-active' : ''}`}
              onClick={openSettings}
              aria-label="Match settings"
            >
              <Settings size={18} />
            </button>
            <button type="button" onClick={() => void handleLogout()} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>
      </header>

      <div className="live-hero">
        {/* Mobile: always show Skip / Next (desktop-skip is hidden ≤768px) */}
        <button
          className="hot-button mobile-skip-btn"
          type="button"
          onClick={() => void handleLeave()}
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
            <span>Searching</span>
            <SearchingDots />
          </button>
        )}
        <p>{statusLine}</p>
        <button
          className="unlock-button desktop-premium-btn"
          type="button"
          onClick={openSubscription}
        >
          <Crown size={16} /> Premium
        </button>
      </div>

      <main className="video-stage">
        <section
          className={`partner-video${videoReady ? ' video-ready' : ''}${isConnected ? ' is-connected' : ''}${showPartnerLoading ? ' is-loading' : ''}${isSearching ? ' is-searching' : ''}`}
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
            className={`partner-loading-layer${showPartnerLoading ? ' is-visible' : ''}`}
            aria-hidden={!showPartnerLoading}
          >
            <div className="partner-loading-shimmer" />
            <div className="live-partner-placeholder">
              {isUnmod ? '🎲' : '💘'}
            </div>
            {showPartnerLoading && (
              <span className="partner-loading-label">
                {isConnecting ? 'Connecting…' : 'Searching…'}
              </span>
            )}
          </div>
          <span className="video-label">Partner</span>
          {Boolean(match?.partnerIsVip) && (
            <span className="video-label vip-badge partner-vip-badge">VIP</span>
          )}

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

            {Boolean(match?.partnerIsVip) && (
              <div className="filter-pill-wrap">
                <button
                  type="button"
                  className={selectedTip || customTip ? 'active' : ''}
                  onClick={() => {
                    setShowTipPicker((v) => !v);
                    setShowCountryPicker(false);
                    setShowGenderPicker(false);
                    setShowTagInput(false);
                    setTipStatus('');
                  }}
                >
                  💸 Tip
                </button>
                {showTipPicker && (
                  <div className="country-dropdown tip-dropdown">
                    <p className="tag-hint tip-dropdown-title">
                      Tip VIP creator {match?.partnerIdentity || ''}
                    </p>
                    <div className="tip-options">
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
                      className="tip-send-btn"
                      onClick={() => void sendTip()}
                      disabled={tipSending}
                    >
                      {tipSending ? 'Sending…' : 'Send Tip'}
                    </button>
                    {tipStatus && <p className="tip-status">{tipStatus}</p>}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="partner-copy">
            <strong>
              {partnerTitle}
              {Boolean(match?.partnerIsVip) && partnerFeedReady && (
                <span className="partner-vip-inline">VIP</span>
              )}
            </strong>
            <span>{partnerSubtitle}</span>
          </div>
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
                ((isConnected && !isSkipping) || hasPreview) && camEnabled
                  ? 0
                  : 0.5,
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
              zIndex:
                camEnabled && hasPreview && (!isConnected || isSkipping)
                  ? 10
                  : -1,
              opacity:
                camEnabled && hasPreview && (!isConnected || isSkipping)
                  ? 1
                  : 0,
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
              zIndex: camEnabled && isConnected && !isSkipping ? 10 : -1,
              opacity: camEnabled && isConnected && !isSkipping ? 1 : 0,
            }}
          />
          {(((!isConnected || isSkipping) && (!hasPreview || !camEnabled)) ||
            (isConnected && !isSkipping && !camEnabled)) && (
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
                {msg.text}
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

      {showSettings && isMobileView && (
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

            <button
              type="button"
              className="live-settings-premium unlock-button"
              onClick={openSubscription}
            >
              <Crown size={16} /> Premium
            </button>

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

            {Boolean(match?.partnerIsVip) && (
              <section className="live-settings-section">
                <h4>Tip Creator</h4>
                <p className="live-settings-current">
                  Tip VIP {match?.partnerIdentity || 'creator'}
                </p>
                <div className="live-settings-options tip-options">
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
                  className="tip-send-btn"
                  onClick={() => void sendTip()}
                  disabled={tipSending}
                >
                  {tipSending ? 'Sending…' : 'Send Tip'}
                </button>
                {tipStatus && <p className="tip-status">{tipStatus}</p>}
              </section>
            )}
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

      {tipToast && (
        <div className="tip-toast" role="status" aria-live="polite">
          <div className="tip-toast-glow" aria-hidden="true" />
          <div className="tip-toast-icon" aria-hidden="true">
            💸
          </div>
          <div className="tip-toast-copy">
            <strong>New tip received!</strong>
            <span>
              <b>{tipToast.fromIdentity}</b> sent you{' '}
              <em>{tipToast.amount}</em>
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
    </div>
  );
}
