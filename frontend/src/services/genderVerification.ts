import { apiUrl } from '../utils/api';
import { authHeaders } from '../utils/auth';

export type GenderVerificationResponse = {
  faceDetected: boolean;
  multipleFaces?: boolean;
  gender?: 'male' | 'female';
  confidence?: number;
  expectedGender: 'male' | 'female';
  matchesProfile: boolean | null;
  confidenceAccepted: boolean;
  verificationPassed: boolean;
  accountBanned: boolean;
};

const VIDEO_READY_TIMEOUT_MS = 10_000;
const FRAME_WARMUP_TIMEOUT_MS = 5_000;

function nestErrorMessage(
  body: { error?: string; message?: string | string[]; code?: string },
  fallback: string,
): string {
  const msg = body.message;
  if (typeof msg === 'string' && msg.trim()) return msg;
  if (Array.isArray(msg) && msg.length > 0) return msg.map(String).join(' ');
  if (typeof body.error === 'string' && body.error.trim()) return body.error;
  return fallback;
}

function waitForVideo(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('Camera did not become ready in time.'));
    }, VIDEO_READY_TIMEOUT_MS);

    const onReady = () => {
      if (video.videoWidth <= 0 || video.videoHeight <= 0) return;
      cleanup();
      resolve();
    };

    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('playing', onReady);
      video.removeEventListener('resize', onReady);
    };

    video.addEventListener('loadeddata', onReady);
    video.addEventListener('playing', onReady);
    video.addEventListener('resize', onReady);
  });
}

/** Avoid capturing the black first frames common on iOS/Android after getUserMedia. */
async function waitForUsableFrame(video: HTMLVideoElement): Promise<void> {
  await video.play().catch(() => undefined);

  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return;

  const deadline = Date.now() + FRAME_WARMUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      context.drawImage(video, 0, 0, 32, 32);
      const { data } = context.getImageData(0, 0, 32, 32);
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) {
        sum += data[i] + data[i + 1] + data[i + 2];
      }
      const average = sum / ((data.length / 4) * 3);
      // Real camera frames are rarely near-black once the sensor is live.
      if (average > 12) return;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }
}

function captureFrame(video: HTMLVideoElement): string {
  const maxWidth = 640;
  const scale = Math.min(1, maxWidth / video.videoWidth);
  const width = Math.max(1, Math.round(video.videoWidth * scale));
  const height = Math.max(1, Math.round(video.videoHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Unable to capture a camera frame.');
  }
  context.drawImage(video, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.78);
}

export async function verifyVideoFrame(
  video: HTMLVideoElement,
  options?: { waitForReady?: boolean },
): Promise<GenderVerificationResponse> {
  if (options?.waitForReady !== false) {
    await waitForVideo(video);
    await waitForUsableFrame(video);
  } else if (video.videoWidth <= 0 || video.videoHeight <= 0) {
    throw new Error('Camera frame is not ready.');
  }
  const image = captureFrame(video);
  const response = await fetch(apiUrl('/api/gender-verification'), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ image }),
  });
  const body = (await response.json().catch(() => ({}))) as
    | GenderVerificationResponse
    | { error?: string; message?: string | string[]; code?: string };

  if (!response.ok) {
    const err = new Error(
      nestErrorMessage(
        body as { error?: string; message?: string | string[] },
        `Gender verification failed (${response.status}).`,
      ),
    ) as Error & { code?: string };
    if ('code' in body && typeof body.code === 'string') {
      err.code = body.code;
    }
    throw err;
  }

  return body as GenderVerificationResponse;
}
