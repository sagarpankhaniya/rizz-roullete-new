import api from "../lib/api";

export type ChatParticipant = {
  id: string;
  firstName: string;
  email: string;
  isVip: boolean;
};

export type AdminChatConversation = {
  roomName: string;
  messageCount: number;
  firstSentAt: number;
  lastSentAt: number;
  lastMessage: {
    text: string;
    senderIdentity: string;
  };
  participantPairKey: string | null;
  senderIdentity: string;
  recipientIdentity: string;
  sender: ChatParticipant | null;
  recipient: ChatParticipant | null;
};

export type AdminChatMessage = {
  id: string;
  roomName: string;
  text: string;
  sentAt: number;
  senderIdentity: string;
  recipientIdentity: string;
  senderUserId: string | null;
  recipientUserId: string | null;
  sender: ChatParticipant | null;
  recipient: ChatParticipant | null;
};

export type PaginatedChatConversations = {
  success: boolean;
  items: AdminChatConversation[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type PaginatedChatMessages = {
  success: boolean;
  items: AdminChatMessage[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type ListChatConversationsParams = {
  page?: number;
  limit?: number;
  userId?: string;
  userIdA?: string;
  userIdB?: string;
  roomName?: string;
  search?: string;
  from?: string;
  to?: string;
};

export type ListChatMessagesParams = {
  page?: number;
  limit?: number;
  roomName?: string;
  userId?: string;
  userIdA?: string;
  userIdB?: string;
  from?: string;
  to?: string;
};

export async function listChatConversations(
  params: ListChatConversationsParams = {},
) {
  const { data } = await api.get<PaginatedChatConversations>(
    "/admin/chat/conversations",
    { params },
  );
  return data;
}

export async function listChatMessages(params: ListChatMessagesParams = {}) {
  const { data } = await api.get<PaginatedChatMessages>(
    "/admin/chat/messages",
    { params },
  );
  return data;
}
