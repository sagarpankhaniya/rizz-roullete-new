import {
  ConnectionState,
  LocalVideoTrack,
  Room,
  RoomEvent,
  Track,
  VideoPresets,
  VideoQuality,
  type LocalTrackPublication,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
  type VideoCaptureOptions,
} from 'livekit-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MatchedPayload } from '../types/events';

interface UseLiveKitRoomOptions {
  match: MatchedPayload | null;
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

/**
 * Prefer a front-facing device by label when facingMode alone is ignored
 * (common on Android after another getUserMedia session held the front cam).
 */
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

/**
 * Connects to a self-hosted LiveKit room using credentials from NestJS.
 *
 * The WebSocket URL and participant token come only from the `matched`
 * Socket.IO payload — never from frontend env or LiveKit Cloud.
 *
 * Always prefers the front (user-facing) camera on mobile.
 */
export function useLiveKitRoom({
  match,
  onConnected,
  onDisconnected,
  onError,
  onBeforeEnableCamera,
}: UseLiveKitRoomOptions) {
  const roomRef = useRef<Room | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const micEnabledRef = useRef(true);
  const camEnabledRef = useRef(true);
  const facingModeRef = useRef<'user' | 'environment'>('user');

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

  const onConnectedRef = useRef(onConnected);
  const onDisconnectedRef = useRef(onDisconnected);
  const onErrorRef = useRef(onError);
  const onBeforeEnableCameraRef = useRef(onBeforeEnableCamera);
  onConnectedRef.current = onConnected;
  onDisconnectedRef.current = onDisconnected;
  onErrorRef.current = onError;
  onBeforeEnableCameraRef.current = onBeforeEnableCamera;

  useEffect(() => {
    if (!match) {
      return;
    }

    let cancelled = false;
    const room = new Room({
      adaptiveStream: { pixelDensity: 'screen' },
      dynacast: true,
      videoCaptureDefaults: FRONT_CAMERA,
      publishDefaults: {
        videoEncoding: VideoPresets.h1080.encoding,
        videoSimulcastLayers: [VideoPresets.h540, VideoPresets.h720],
      },
    });
    roomRef.current = room;
    setFacingMode('user');
    facingModeRef.current = 'user';

    const preferHighRemoteVideo = (publication: RemoteTrackPublication) => {
      if (publication.kind === Track.Kind.Video) {
        publication.setVideoQuality(VideoQuality.HIGH);
      }
    };

    const attachLocalVideo = () => {
      const localPub = room.localParticipant.getTrackPublication(
        Track.Source.Camera,
      );
      const track = localPub?.track;
      if (track && localVideoRef.current) {
        track.attach(localVideoRef.current);
      }
    };

    const attachRemoteTrack = (
      track: RemoteTrack,
      publication: RemoteTrackPublication,
      participant: RemoteParticipant,
    ) => {
      setRemoteIdentity(participant.identity);
      preferHighRemoteVideo(publication);

      if (track.kind === Track.Kind.Video && remoteVideoRef.current) {
        track.attach(remoteVideoRef.current);
      }
      if (track.kind === Track.Kind.Audio && remoteAudioRef.current) {
        track.attach(remoteAudioRef.current);
      }
    };

    const onTrackSubscribed = (
      track: RemoteTrack,
      publication: RemoteTrackPublication,
      participant: RemoteParticipant,
    ) => {
      attachRemoteTrack(track, publication, participant);
    };

    const onLocalTrackPublished = (publication: LocalTrackPublication) => {
      if (publication.source === Track.Source.Camera) {
        attachLocalVideo();
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
        onDisconnectedRef.current?.();
      }
    };

    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
    room.on(RoomEvent.LocalTrackPublished, onLocalTrackPublished);
    room.on(RoomEvent.ConnectionStateChanged, onConnectionStateChanged);
    room.on(RoomEvent.TrackMuted, syncLocalMediaState);
    room.on(RoomEvent.TrackUnmuted, syncLocalMediaState);

    room.on(RoomEvent.ParticipantConnected, (participant) => {
      setRemoteIdentity(participant.identity);
    });

    const connect = async () => {
      try {
        await room.connect(match.livekitUrl, match.token);

        if (cancelled) {
          await room.disconnect();
          return;
        }

        // Release CallApp preview tracks first — if the front cam is still
        // held, mobile browsers often hand LiveKit the rear camera instead.
        await onBeforeEnableCameraRef.current?.();
        // Give the OS a tick to fully release the previous MediaStreamTrack.
        await new Promise((r) => setTimeout(r, 50));

        if (cancelled) {
          await room.disconnect();
          return;
        }

        const camOptions = await resolveFrontCameraOptions();
        await room.localParticipant.setCameraEnabled(
          camEnabledRef.current,
          camOptions,
        );
        await room.localParticipant.setMicrophoneEnabled(micEnabledRef.current);
        attachLocalVideo();
        syncLocalMediaState();

        for (const participant of room.remoteParticipants.values()) {
          setRemoteIdentity(participant.identity);
          for (const publication of participant.trackPublications.values()) {
            preferHighRemoteVideo(publication as RemoteTrackPublication);
            if (publication.track) {
              attachRemoteTrack(
                publication.track as RemoteTrack,
                publication as RemoteTrackPublication,
                participant,
              );
            }
          }
        }
      } catch (error) {
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
      room.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
      room.off(RoomEvent.LocalTrackPublished, onLocalTrackPublished);
      room.off(RoomEvent.ConnectionStateChanged, onConnectionStateChanged);
      room.off(RoomEvent.TrackMuted, syncLocalMediaState);
      room.off(RoomEvent.TrackUnmuted, syncLocalMediaState);
      // Detach remote only — local PiP is handed back to CallApp preview
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
        remoteVideoRef.current.load();
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = null;
      }
      void room.disconnect();
      roomRef.current = null;
      setConnectionState(ConnectionState.Disconnected);
      setRemoteIdentity(null);
    };
  }, [match]);

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

  const disconnect = useCallback(async () => {
    // Keep last local frame until CallApp restarts preview — only clear remote here
    clearRemoteMedia();
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

  /** Flip between front and rear camera (preview or live LiveKit track). */
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
  };
}
