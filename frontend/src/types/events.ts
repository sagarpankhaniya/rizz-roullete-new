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
  START_CALL: 'start_call',
  LEAVE_CALL: 'leave_call',
  SEND_CHAT: 'send_chat',
  SEND_TIP: 'send_tip',
  WAITING: 'waiting',
  MATCHED: 'matched',
  PARTNER_LEFT: 'partner_left',
  CHAT_MESSAGE: 'chat_message',
  TIP_RECEIVED: 'tip_received',
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