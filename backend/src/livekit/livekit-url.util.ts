/**
 * Converts a LiveKit client WebSocket URL (ws:// / wss://) into the HTTP(S)
 * base URL required by RoomServiceClient on the self-hosted server.
 *
 * On a single Ubuntu VPS, both typically share the same host/port (e.g. :7880),
 * or sit behind Nginx with the same public hostname.
 */
export function livekitWsUrlToHttpHost(wsUrl: string): string {
  const trimmed = wsUrl.trim();
  if (trimmed.startsWith('wss://')) {
    return `https://${trimmed.slice('wss://'.length)}`;
  }
  if (trimmed.startsWith('ws://')) {
    return `http://${trimmed.slice('ws://'.length)}`;
  }
  throw new Error(
    `LIVEKIT_URL must start with ws:// or wss:// (got: ${wsUrl})`,
  );
}
