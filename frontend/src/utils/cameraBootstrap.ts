/**
 * iOS Safari only grants getUserMedia reliably inside the same user-gesture
 * stack as a button tap. Login/register runs here so CallApp can reuse the
 * stream instead of requesting the camera again from a useEffect.
 */

let bootStream: MediaStream | null = null;

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

/** Hand ownership of the bootstrapped stream to CallApp (single consumer). */
export function takeBootstrappedCamera(): MediaStream | null {
  const stream = bootStream;
  bootStream = null;
  return stream;
}

export function discardBootstrappedCamera(): void {
  bootStream?.getTracks().forEach((track) => track.stop());
  bootStream = null;
}
