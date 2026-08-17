import {
  ConnectionState,
  LocalVideoTrack,
  Room,
  RoomEvent,
  Track,
  VideoPresets,
  type LocalTrackPublication,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
  type VideoCaptureOptions,
} from 'livekit-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { LiveKitCredentials } from '../types/events';
import {
  applyOutboundEncodingHints,
  installPublisherSdpBitrateHints,
  isMobileDevice,
  preferHighRemoteVideo,
  startPublisherStatsLogging,
  stopPublisherStatsLogging,
} from '../utils/livekitVideoQuality';

interface UseLiveKitRoomOptions {
  /** Pool-room credentials — issued on waiting, reused across skips */
  session: LiveKitCredentials | null;
  /** LiveKit identity of the current partner — drives selective subscription */
  partnerLivekitIdentity: string | null;
  /** Connect + publish while searching or in a call */
  active: boolean;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (message: string) => void;
  /** Called before LiveKit opens the camera so CallApp can release preview tracks. */
  onBeforeEnableCamera?: () => void | Promise<void>;
}

const FRONT_CAMERA: VideoCaptureOptions = {
  resolution: VideoPresets.h1080.resolution,
  facingMode: 'user',
};

async function resolveFrontCameraOptions(): Promise<VideoCaptureOptions> {
  try {
    const devices = await Room.getLocalDevices('videoinput', true);
    const front = devices.find((d) =>
      /front|user|face|facing.?user/i.test(d.label),
    );
    if (front?.deviceId) {
      return {
        ...FRONT_CAMERA,
        deviceId: front.deviceId,
      };
    }
  } catch {
    // Fall through to facingMode-only constraints.
  }
  return FRONT_CAMERA;
}

function createRoomInstance(): Room {
  return new Room({
    adaptiveStream: { pixelDensity: 'screen' },
    dynacast: true,
    videoCaptureDefaults: FRONT_CAMERA,
    publishDefaults: {
      videoEncoding: {
        maxBitrate: 2_500_000,
        maxFramerate: 30,
      },
      videoSimulcastLayers: [VideoPresets.h540, VideoPresets.h720],
      degradationPreference: 'maintain-resolution',
      ...(isMobileDevice() ? { videoCodec: 'h264' as const } : {}),
    },
  });
}

/**
 * Persistent LiveKit pool connection — transport survives skip/next.
 * Subscribes only to the matched partner via selective subscription.
 */
export function useLiveKitRoom({
  session,
  partnerLivekitIdentity,
  active,
  onConnected,
  onDisconnected,
  onError,
  onBeforeEnableCamera,
}: UseLiveKitRoomOptions) {
  const roomRef = useRef<Room | null>(null);
  const connectedRoomRef = useRef<string | null>(null);
  const partnerRef = useRef<string | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const micEnabledRef = useRef(true);
  const camEnabledRef = useRef(true);
  const facingModeRef = useRef<'user' | 'environment'>('user');
  const connectGenRef = useRef(0);

  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.Disconnected,
  );
  const [remoteIdentity, setRemoteIdentity] = useState<string | null>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  micEnabledRef.current = micEnabled;
  camEnabledRef.current = camEnabled;
  facingModeRef.current = facingMode;
  partnerRef.current = partnerLivekitIdentity;

  const onConnectedRef = useRef(onConnected);
  const onDisconnectedRef = useRef(onDisconnected);
  const onErrorRef = useRef(onError);
  const onBeforeEnableCameraRef = useRef(onBeforeEnableCamera);
  onConnectedRef.current = onConnected;
  onDisconnectedRef.current = onDisconnected;
  onErrorRef.current = onError;
  onBeforeEnableCameraRef.current = onBeforeEnableCamera;

  const attachLocalVideo = useCallback((room: Room) => {
    const localPub = room.localParticipant.getTrackPublication(
      Track.Source.Camera,
    );
    const track = localPub?.track;
    if (track && localVideoRef.current) {
      track.attach(localVideoRef.current);
    }
  }, []);

  const attachRemoteTrack = useCallback(
    (
      track: RemoteTrack,
      publication: RemoteTrackPublication,
      participant: RemoteParticipant,
    ) => {
      if (participant.identity !== partnerRef.current) {
        return;
      }

      setRemoteIdentity(participant.identity);
      preferHighRemoteVideo(publication);

      if (track.kind === Track.Kind.Video && remoteVideoRef.current) {
        track.attach(remoteVideoRef.current);
      }
      if (track.kind === Track.Kind.Audio && remoteAudioRef.current) {
        track.attach(remoteAudioRef.current);
      }
    },
    [],
  );

  const unsubscribeAllRemote = useCallback((room: Room) => {
    for (const participant of room.remoteParticipants.values()) {
      for (const publication of participant.trackPublications.values()) {
        (publication as RemoteTrackPublication).setSubscribed(false);
      }
    }
  }, []);

  const subscribeToPartner = useCallback(
    (room: Room, identity: string | null) => {
      unsubscribeAllRemote(room);

      if (!identity) {
        setRemoteIdentity(null);
        return;
      }

      const participant = room.remoteParticipants.get(identity);
      if (!participant) {
        setRemoteIdentity(null);
        return;
      }

      setRemoteIdentity(participant.identity);
      for (const publication of participant.trackPublications.values()) {
        const remotePub = publication as RemoteTrackPublication;
        remotePub.setSubscribed(true);
        preferHighRemoteVideo(remotePub);
        if (remotePub.track) {
          attachRemoteTrack(
            remotePub.track as RemoteTrack,
            remotePub,
            participant,
          );
        }
      }
    },
    [attachRemoteTrack, unsubscribeAllRemote],
  );

  const ensureRoom = useCallback(() => {
    if (!roomRef.current) {
      const room = createRoomInstance();
      roomRef.current = room;

      const onTrackSubscribed = (
        track: RemoteTrack,
        publication: RemoteTrackPublication,
        participant: RemoteParticipant,
      ) => {
        if (participant.identity !== partnerRef.current) {
          return;
        }
        attachRemoteTrack(track, publication, participant);
        startPublisherStatsLogging(room, `match-${participant.identity}`);
      };

      const onTrackPublished = (
        publication: RemoteTrackPublication,
        participant: RemoteParticipant,
      ) => {
        if (participant.identity !== partnerRef.current) {
          publication.setSubscribed(false);
          return;
        }
        publication.setSubscribed(true);
        preferHighRemoteVideo(publication);
      };

      const onParticipantConnected = (participant: RemoteParticipant) => {
        if (participant.identity === partnerRef.current) {
          subscribeToPartner(room, participant.identity);
        } else {
          for (const publication of participant.trackPublications.values()) {
            (publication as RemoteTrackPublication).setSubscribed(false);
          }
        }
      };

      const onLocalTrackPublished = (publication: LocalTrackPublication) => {
        if (publication.source === Track.Source.Camera) {
          attachLocalVideo(room);
          installPublisherSdpBitrateHints(room);
          void applyOutboundEncodingHints(room);
        }
      };

      const syncLocalMediaState = () => {
        setMicEnabled(room.localParticipant.isMicrophoneEnabled);
        setCamEnabled(room.localParticipant.isCameraEnabled);
      };

      const onConnectionStateChanged = (state: ConnectionState) => {
        setConnectionState(state);
        if (state === ConnectionState.Connected) {
          onConnectedRef.current?.();
        }
        if (state === ConnectionState.Disconnected) {
          connectedRoomRef.current = null;
          onDisconnectedRef.current?.();
        }
      };

      room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
      room.on(RoomEvent.TrackPublished, onTrackPublished);
      room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
      room.on(RoomEvent.LocalTrackPublished, onLocalTrackPublished);
      room.on(RoomEvent.ConnectionStateChanged, onConnectionStateChanged);
      room.on(RoomEvent.TrackMuted, syncLocalMediaState);
      room.on(RoomEvent.TrackUnmuted, syncLocalMediaState);
    }

    return roomRef.current;
  }, [attachLocalVideo, attachRemoteTrack, subscribeToPartner]);

  // Connect once to the pool room; publish during search so BWE ramps early.
  useEffect(() => {
    if (!active || !session) {
      return;
    }

    const room = ensureRoom();
    const gen = ++connectGenRef.current;
    let cancelled = false;

    const connect = async () => {
      try {
        if (
          room.state === ConnectionState.Connected &&
          connectedRoomRef.current === session.roomName
        ) {
          return;
        }

        if (room.state !== ConnectionState.Disconnected) {
          await room.disconnect();
        }

        await room.connect(session.livekitUrl, session.token, {
          autoSubscribe: false,
        });

        if (cancelled || gen !== connectGenRef.current) {
          return;
        }

        connectedRoomRef.current = session.roomName;
        installPublisherSdpBitrateHints(room);

        await onBeforeEnableCameraRef.current?.();
        await new Promise((r) => setTimeout(r, 50));

        if (cancelled || gen !== connectGenRef.current) {
          return;
        }

        const camOptions = await resolveFrontCameraOptions();
        await room.localParticipant.setCameraEnabled(
          camEnabledRef.current,
          camOptions,
        );
        await room.localParticipant.setMicrophoneEnabled(micEnabledRef.current);
        attachLocalVideo(room);
        setFacingMode('user');
        facingModeRef.current = 'user';

        installPublisherSdpBitrateHints(room);
        await applyOutboundEncodingHints(room);
        startPublisherStatsLogging(room, 'preconnect');
      } catch (error) {
        if (cancelled || gen !== connectGenRef.current) {
          return;
        }
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to connect to LiveKit room.';
        onErrorRef.current?.(message);
      }
    };

    void connect();

    return () => {
      cancelled = true;
    };
  }, [active, session, ensureRoom, attachLocalVideo]);

  // Switch partner subscription without tearing down transport.
  useEffect(() => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) {
      return;
    }

    if (!partnerLivekitIdentity) {
      unsubscribeAllRemote(room);
      setRemoteIdentity(null);
      return;
    }

    subscribeToPartner(room, partnerLivekitIdentity);
    startPublisherStatsLogging(room, `match-${partnerLivekitIdentity}`);
  }, [
    partnerLivekitIdentity,
    subscribeToPartner,
    unsubscribeAllRemote,
  ]);

  const clearRemoteMedia = useCallback(() => {
    const video = remoteVideoRef.current;
    if (video) {
      video.srcObject = null;
      video.removeAttribute('src');
      video.load();
    }
    const audio = remoteAudioRef.current;
    if (audio) {
      audio.srcObject = null;
      audio.load();
    }
    setRemoteIdentity(null);
  }, []);

  const unsubscribePartner = useCallback(() => {
    const room = roomRef.current;
    if (room && room.state === ConnectionState.Connected) {
      unsubscribeAllRemote(room);
    }
    clearRemoteMedia();
    stopPublisherStatsLogging();
  }, [clearRemoteMedia, unsubscribeAllRemote]);

  const disconnect = useCallback(async () => {
    stopPublisherStatsLogging();
    clearRemoteMedia();
    connectedRoomRef.current = null;
    connectGenRef.current += 1;
    await roomRef.current?.disconnect();
    roomRef.current = null;
    setConnectionState(ConnectionState.Disconnected);
  }, [clearRemoteMedia]);

  const toggleMic = useCallback(async () => {
    const room = roomRef.current;
    const next = !micEnabledRef.current;
    setMicEnabled(next);
    if (room) {
      try {
        await room.localParticipant.setMicrophoneEnabled(next);
        setMicEnabled(room.localParticipant.isMicrophoneEnabled);
      } catch {
        setMicEnabled(!next);
      }
    }
  }, []);

  const toggleCam = useCallback(async () => {
    const room = roomRef.current;
    const next = !camEnabledRef.current;
    setCamEnabled(next);
    if (room) {
      try {
        const camOptions =
          facingModeRef.current === 'user'
            ? await resolveFrontCameraOptions()
            : {
                resolution: VideoPresets.h1080.resolution,
                facingMode: 'environment' as const,
              };
        await room.localParticipant.setCameraEnabled(next, camOptions);
        setCamEnabled(room.localParticipant.isCameraEnabled);
        const localPub = room.localParticipant.getTrackPublication(
          Track.Source.Camera,
        );
        const track = localPub?.track;
        if (track && localVideoRef.current && next) {
          track.attach(localVideoRef.current);
        }
      } catch {
        setCamEnabled(!next);
      }
    }
  }, []);

  const switchCamera = useCallback(async () => {
    const next: 'user' | 'environment' =
      facingModeRef.current === 'user' ? 'environment' : 'user';
    const room = roomRef.current;
    const localPub = room?.localParticipant.getTrackPublication(
      Track.Source.Camera,
    );
    const track = localPub?.track;

    if (track instanceof LocalVideoTrack) {
      try {
        const options: VideoCaptureOptions =
          next === 'user'
            ? await resolveFrontCameraOptions()
            : {
                resolution: VideoPresets.h1080.resolution,
                facingMode: 'environment',
              };
        await track.restartTrack(options);
        setFacingMode(next);
        if (localVideoRef.current) {
          track.attach(localVideoRef.current);
        }
      } catch {
        // Keep previous facing on failure.
      }
      return;
    }

    setFacingMode(next);
  }, []);

  useEffect(
    () => () => {
      stopPublisherStatsLogging();
      void roomRef.current?.disconnect();
      roomRef.current = null;
    },
    [],
  );

  return {
    localVideoRef,
    remoteVideoRef,
    remoteAudioRef,
    connectionState,
    remoteIdentity,
    micEnabled,
    camEnabled,
    facingMode,
    toggleMic,
    toggleCam,
    switchCamera,
    disconnect,
    clearRemoteMedia,
    unsubscribePartner,
  };
}
