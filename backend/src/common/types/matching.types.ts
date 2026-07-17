/**
 * Socket.IO event contracts between NestJS and React clients.
 * Keep these in sync with the frontend `types/events.ts` file.
 */

export interface WaitingUser {
  socketId: string;
  identity: string;
  joinedAt: Date;
  gender: 'male' | 'female';
  interestedIn: 'male' | 'female' | 'everyone';
  /** Redis bucket key segment `{gender}:{interestedIn}` */
  bucket: string;
  /** Creator-invite VIP flag from users.isVip */
  isVip?: boolean;
}

export interface StartCallPayload {
  identity?: string;
  /** Fallback when JWT/user lookup is unavailable */
  gender?: string;
  interestedIn?: string;
}

export interface MatchedPayload {
  roomName: string;
  /** LiveKit WebSocket URL for the client SDK (LIVEKIT_URL) */
  livekitUrl: string;
  token: string;
  identity: string;
  partnerIdentity: string;
  /** Whether the remote partner has creator VIP */
  partnerIsVip: boolean;
}

export interface PartnerLeftPayload {
  reason: string;
}

export interface SendChatPayload {
  text: string;
}

export interface ChatMessagePayload {
  text: string;
  fromIdentity: string;
  sentAt: number;
}

export interface SendTipPayload {
  amount: string;
}

export interface TipReceivedPayload {
  amount: string;
  fromIdentity: string;
  sentAt: number;
}

export const SOCKET_EVENTS = {
  /** Client → server: join the waiting queue */
  START_CALL: 'start_call',
  /** Client → server: leave the queue or active call */
  LEAVE_CALL: 'leave_call',
  /** Client → server: ephemeral in-call chat (not persisted) */
  SEND_CHAT: 'send_chat',
  /** Client → server: tip the current partner (VIP creator) */
  SEND_TIP: 'send_tip',
  /** Server → client: waiting for another user */
  WAITING: 'waiting',
  /** Server → client: matched; includes LiveKit credentials */
  MATCHED: 'matched',
  /** Server → client: partner disconnected */
  PARTNER_LEFT: 'partner_left',
  /** Server → client: ephemeral chat message from partner */
  CHAT_MESSAGE: 'chat_message',
  /** Server → client: tip received from partner */
  TIP_RECEIVED: 'tip_received',
  /** Server → client: recoverable error message */
  ERROR: 'error',
} as const;

