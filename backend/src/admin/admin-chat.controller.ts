import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { AdminChatService } from './admin-chat.service';
import { ListAdminChatConversationsQueryDto } from './dto/list-chat-conversations.query.dto';
import { ListAdminChatMessagesQueryDto } from './dto/list-chat-messages.query.dto';

@Controller('api/admin/chat')
@UseGuards(AdminAuthGuard)
export class AdminChatController {
  constructor(private readonly adminChatService: AdminChatService) {}

  @Get('conversations')
  async listConversations(@Query() query: ListAdminChatConversationsQueryDto) {
    const result = await this.adminChatService.listConversations(query);
    return { success: true, ...result };
  }

  @Get('messages')
  async listMessages(@Query() query: ListAdminChatMessagesQueryDto) {
    const result = await this.adminChatService.listMessages(query);
    return { success: true, ...result };
  }
}
