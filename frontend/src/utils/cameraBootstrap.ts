/**
 * iOS Safari only grants getUserMedia reliably inside the same user-gesture
 * stack as a button tap. Login/register (and the mobile session-restore gate)
 * run here so CallApp can reuse the stream instead of requesting the camera
 * again from a useEffect.
 */

let bootStream: MediaStream | null = null;

/** Touch / iOS devices that often reject getUserMedia outside a tap. */
export function deviceNeedsCameraGesture(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(pointer: coarse)').matches ||
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/** iOS/iPadOS always need a user-gesture tap to reopen the camera. */
export function deviceRequiresCameraTapGate(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export async function bootstrapCameraFromUserGesture(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return false;
  }

  // Reuse a live stream if we already prompted during this session.
  const existing = bootStream?.getVideoTracks()[0];
  if (existing && existing.readyState === 'live') {
    return true;
  }

  try {
    bootStream?.getTracks().forEach((track) => track.stop());
    bootStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'user' },
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
      audio: false,
    });
    return true;
  } catch {
    bootStream = null;
    return false;
  }
}

/**
 * Hand the bootstrapped stream to CallApp. Keeps the module ref while tracks
 * are live so React StrictMode remount can reclaim the same stream.
 */
export function takeBootstrappedCamera(): MediaStream | null {
  const stream = bootStream;
  if (!stream) return null;
  const track = stream.getVideoTracks()[0];
  if (!track || track.readyState !== 'live') {
    bootStream = null;
    return null;
  }
  return stream;
}

/** Park a live preview across StrictMode unmount without stopping tracks. */
export function parkCameraStream(stream: MediaStream | null): void {
  if (!stream) return;
  const track = stream.getVideoTracks()[0];
  if (track && track.readyState === 'live') {
    bootStream = stream;
    return;
  }
  stream.getTracks().forEach((t) => t.stop());
  if (bootStream === stream) bootStream = null;
}

/** Drop the module ref after tracks were already stopped elsewhere. */
export function clearBootstrappedCameraRef(stream?: MediaStream | null): void {
  if (stream == null || bootStream === stream) {
    bootStream = null;
  }
}

export function discardBootstrappedCamera(): void {
  bootStream?.getTracks().forEach((track) => track.stop());
  bootStream = null;
}
