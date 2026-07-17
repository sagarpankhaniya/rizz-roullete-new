import { io, Socket } from 'socket.io-client';
import { getToken } from '../utils/auth';

/**
 * Same-origin by default (Vite proxies /socket.io → NestJS).
 * Set VITE_BACKEND_URL only when the API is on a different host.
 */
const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || undefined;

let socket: Socket | null = null;

/**
 * Singleton Socket.IO connection to the NestJS matching gateway.
 * Passes JWT so the server can load gender / interestedIn from registration.
 *
 * IMPORTANT: socket.io-client treats `auth` as either a plain object OR
 * `auth(cb)` — a function that *calls* the callback. Returning a value is ignored
 * and the handshake never completes.
 */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: true,
      transports: ['websocket', 'polling'],
      auth: (cb: (data: Record<string, string>) => void) => {
        const token = getToken();
        cb(token ? { token } : {});
      },
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
