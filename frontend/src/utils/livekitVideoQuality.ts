import {
  LocalVideoTrack,
  Room,
  Track,
  VideoQuality,
  type RemoteTrackPublication,
} from 'livekit-client';

/** Publisher SDP hints — applied on every local video offer/answer. */
const GOOGLE_START_BITRATE = 1500;
const GOOGLE_MIN_BITRATE = 600;
const GOOGLE_MAX_BITRATE = 2500;

export function isMobileDevice(): boolean {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

export function preferHighRemoteVideo(publication: RemoteTrackPublication): void {
  if (publication.kind === Track.Kind.Video) {
    publication.setVideoQuality(VideoQuality.HIGH);
  }
}

/** Inject x-google-* bitrate hints into video fmtp lines. */
export function injectGoogleBitrateHints(sdp: string): string {
  const hint = `x-google-start-bitrate=${GOOGLE_START_BITRATE};x-google-min-bitrate=${GOOGLE_MIN_BITRATE};x-google-max-bitrate=${GOOGLE_MAX_BITRATE}`;
  return sdp
    .split('\r\n')
    .map((line) => {
      if (!line.startsWith('a=fmtp:')) {
        return line;
      }
      if (line.includes('x-google-start-bitrate')) {
        return line.replace(
          /x-google-start-bitrate=\d+/,
          `x-google-start-bitrate=${GOOGLE_START_BITRATE}`,
        )
          .replace(/x-google-min-bitrate=\d+/, `x-google-min-bitrate=${GOOGLE_MIN_BITRATE}`)
          .replace(/x-google-max-bitrate=\d+/, `x-google-max-bitrate=${GOOGLE_MAX_BITRATE}`);
      }
      return `${line};${hint}`;
    })
    .join('\r\n');
}

function getPublisherPeerConnection(room: Room): RTCPeerConnection | undefined {
  const engine = room.engine as unknown as {
    pcManager?: { publisher?: { pc?: RTCPeerConnection; _pc?: RTCPeerConnection } };
    client?: { publisher?: { pc?: RTCPeerConnection } };
  };
  return (
    engine.pcManager?.publisher?.pc ??
    engine.pcManager?.publisher?._pc ??
    engine.client?.publisher?.pc
  );
}

/** Patch publisher PC so outbound SDP carries higher starting bitrates. */
export function installPublisherSdpBitrateHints(room: Room): void {
  const pc = getPublisherPeerConnection(room);
  if (!pc || (pc as RTCPeerConnection & { __lkBitratePatched?: boolean }).__lkBitratePatched) {
    return;
  }

  const tagged = pc as RTCPeerConnection & { __lkBitratePatched?: boolean };
  tagged.__lkBitratePatched = true;

  const original = pc.setLocalDescription.bind(pc);
  pc.setLocalDescription = async (description) => {
    if (description?.sdp) {
      const munged = injectGoogleBitrateHints(description.sdp);
      return original({ ...description, sdp: munged });
    }
    return original(description);
  };
}

/** RTCRtpSender encoding floor/ceiling after publish. */
export async function applyOutboundEncodingHints(room: Room): Promise<void> {
  for (const pub of room.localParticipant.trackPublications.values()) {
    if (pub.kind !== Track.Kind.Video) continue;
    const track = pub.track;
    if (!(track instanceof LocalVideoTrack)) continue;

    const sender = track.sender;
    if (!sender) continue;

    try {
      const params = sender.getParameters();
      if (!params.encodings?.length) continue;
      for (const enc of params.encodings) {
        enc.maxBitrate = GOOGLE_MAX_BITRATE * 1000;
      }
      await sender.setParameters(params);
    } catch {
      // Non-fatal — SDP hints may still apply.
    }
  }
}

let statsTimer: ReturnType<typeof setInterval> | null = null;

/** Log outbound-rtp targetBitrate + frameWidth for the first 15s of each match. */
export function startPublisherStatsLogging(room: Room, label: string): void {
  stopPublisherStatsLogging();

  let tick = 0;
  statsTimer = setInterval(() => {
    tick += 1;
    if (tick > 15) {
      stopPublisherStatsLogging();
      return;
    }

    const pc = getPublisherPeerConnection(room);
    if (!pc) return;

    void pc.getStats().then((report) => {
      report.forEach((stat) => {
        if (stat.type !== 'outbound-rtp' || stat.kind !== 'video') return;
        const targetBitrate =
          'targetBitrate' in stat ? (stat.targetBitrate as number | undefined) : undefined;
        const frameWidth =
          'frameWidth' in stat ? (stat.frameWidth as number | undefined) : undefined;
        console.info(
          `[lk-stats ${label} t=${tick}s] targetBitrate=${targetBitrate ?? 'n/a'} frameWidth=${frameWidth ?? 'n/a'}`,
        );
      });
    });
  }, 1000);
}

export function stopPublisherStatsLogging(): void {
  if (statsTimer) {
    clearInterval(statsTimer);
    statsTimer = null;
  }
}
