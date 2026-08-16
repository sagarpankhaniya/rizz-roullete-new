import { Injectable } from '@nestjs/common';
import { ChatMessagesService } from '../chat/chat-messages.service';

@Injectable()
export class AdminChatService {
  constructor(private readonly chatMessages: ChatMessagesService) {}

  listConversations(query: {
    page?: number;
    limit?: number;
    userId?: string;
    userIdA?: string;
    userIdB?: string;
    roomName?: string;
    search?: string;
    from?: string;
    to?: string;
  }) {
    return this.chatMessages.listConversations(query);
  }

  listMessages(query: {
    page?: number;
    limit?: number;
    roomName?: string;
    userId?: string;
    userIdA?: string;
    userIdB?: string;
    from?: string;
    to?: string;
  }) {
    return this.chatMessages.listMessages(query);
  }
}
