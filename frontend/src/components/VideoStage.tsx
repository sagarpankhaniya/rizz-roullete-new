import type { RefObject } from 'react';

interface VideoStageProps {
  localVideoRef: RefObject<HTMLVideoElement | null>;
  remoteVideoRef: RefObject<HTMLVideoElement | null>;
  remoteAudioRef: RefObject<HTMLAudioElement | null>;
  localLabel: string;
  remoteLabel: string;
  showRemotePlaceholder: boolean;
}

export function VideoStage({
  localVideoRef,
  remoteVideoRef,
  remoteAudioRef,
  localLabel,
  remoteLabel,
  showRemotePlaceholder,
}: VideoStageProps) {
  return (
    <div className="video-stage">
      <div className="video-tile video-tile--remote">
        <video ref={remoteVideoRef} autoPlay playsInline />
        <audio ref={remoteAudioRef} autoPlay />
        {showRemotePlaceholder && (
          <div className="video-placeholder">Waiting for partner video…</div>
        )}
        <span className="video-label">{remoteLabel}</span>
      </div>

      <div className="video-tile video-tile--local">
        <video ref={localVideoRef} autoPlay playsInline muted />
        <span className="video-label">{localLabel}</span>
      </div>
    </div>
  );
}
