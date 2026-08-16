/**
 * Socket.IO event contracts — keep in sync with backend matching.types.ts
 */

export interface MatchedPayload {
  roomName: string;
  livekitUrl: string;
  token: string;
  identity: string;
  partnerIdentity: string;
  partnerIsVip: boolean;
  /** Mongo user id of the remote partner (for reporting) */
  partnerUserId: string | null;
}

export interface PartnerLeftPayload {
  reason: string;
}

export interface ErrorPayload {
  message: string;
}

export interface WaitingPayload {
  message: string;
}

export interface StartCallPayload {
  identity?: string;
  /** Fallback if socket JWT auth is missing */
  gender?: string;
  interestedIn?: string;
  /** Mongo user id when entering a specific creator's room */
  targetCreatorUserId?: string;
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
  menuItem?: string;
}

export interface TipReceivedPayload {
  amount: string;
  creatorReceived?: string;
  fromIdentity: string;
  sentAt: number;
}

export interface CreatorFanWaitingPayload {
  fanIdentity: string;
  message: string;
}

export const SOCKET_EVENTS = {
  START_CALL: 'start_call',
  LEAVE_CALL: 'leave_call',
  SEND_CHAT: 'send_chat',
  SEND_TIP: 'send_tip',
  WAITING: 'waiting',
  MATCHED: 'matched',
  PARTNER_LEFT: 'partner_left',
  CHAT_MESSAGE: 'chat_message',
  TIP_RECEIVED: 'tip_received',
  /** Server → creator: a paid fan is waiting to enter their room */
  CREATOR_FAN_WAITING: 'creator_fan_waiting',
  ERROR: 'error',
} as const;

export type CallPhase =
  | 'idle'
  | 'connecting'
  | 'waiting'
  | 'matched'
  | 'in_call'
  | 'partner_left'
  | 'error';