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
  /** Mongo user id when authenticated */
  userId?: string;
  /** Fan targeting a specific creator room */
  targetCreatorUserId?: string;
  /** User's registered country (for mutual country filter) */
  country?: string;
  /** Preferred partner country ISO code, if any */
  matchCountry?: string;
}

export interface StartCallPayload {
  identity?: string;
  /** Fallback when JWT/user lookup is unavailable */
  gender?: string;
  interestedIn?: string;
  /** Mongo user id of the creator room the fan wants to enter */
  targetCreatorUserId?: string;
}

export interface LiveKitCredentialsPayload {
  roomName: string;
  /** LiveKit WebSocket URL for the client SDK (LIVEKIT_URL) */
  livekitUrl: string;
  token: string;
  /** Stable LiveKit participant identity (not the display name) */
  livekitIdentity: string;
}

export interface MatchedPayload extends LiveKitCredentialsPayload {
  /** Unique id for this 1:1 pairing — used for reports/chat archival */
  sessionId: string;
  /** Display name for this participant */
  identity: string;
  /** Display name of the remote partner */
  partnerIdentity: string;
  /** LiveKit identity of the remote partner — used for selective subscription */
  partnerLivekitIdentity: string;
  /** Whether the remote partner has creator VIP */
  partnerIsVip: boolean;
  /** Mongo user id of the remote partner (for reporting) */
  partnerUserId: string | null;
}

export interface WaitingPayload extends LiveKitCredentialsPayload {
  message: string;
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
  /** Present when the server translated for the recipient's language preference */
  translatedText?: string;
  detectedLanguage?: string;
}

export interface SetChatTranslatePayload {
  /** BCP-47 code, or null / empty string to disable */
  language: string | null;
}

export interface SendTipPayload {
  amount: string;
  /** Preset menu label or custom request text */
  menuItem?: string;
}

export interface TipReceivedPayload {
  amount: string;
  /** Coins credited to the creator (80% share) */
  creatorReceived?: string;
  fromIdentity: string;
  sentAt: number;
}

export interface CreatorFanWaitingPayload {
  fanIdentity: string;
  message: string;
}

export const SOCKET_EVENTS = {
  /** Client → server: join the waiting queue */
  START_CALL: 'start_call',
  /** Client → server: leave the queue or active call */
  LEAVE_CALL: 'leave_call',
  /** Client → server: recover in-progress call if `matched` was missed */
  SYNC_CALL: 'sync_call',
  /** Client → server: ephemeral in-call chat (not persisted) */
  SEND_CHAT: 'send_chat',
  /** Client → server: set preferred language for incoming chat translations */
  SET_CHAT_TRANSLATE: 'set_chat_translate',
  /** Client → server: tip the current partner (VIP creator) */
  SEND_TIP: 'send_tip',
  /** Server → client: waiting for another user */
  WAITING: 'waiting',
  /** Server → client: matched; includes LiveKit credentials */
  MATCHED: 'matched',
  /** Server → client: socket reconnected — same room + fresh LiveKit token */
  CALL_RESUMED: 'call_resumed',
  /** Server → client: partner disconnected */
  PARTNER_LEFT: 'partner_left',
  /** Server → client: ephemeral chat message from partner */
  CHAT_MESSAGE: 'chat_message',
  /** Server → client: tip received from partner */
  TIP_RECEIVED: 'tip_received',
  /** Server → creator VIP: paid fan waiting for their room */
  CREATOR_FAN_WAITING: 'creator_fan_waiting',
  /** Server → client: recoverable error message */
  ERROR: 'error',
} as const;

