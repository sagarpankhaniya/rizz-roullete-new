import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module';
import {
  ChatMessage,
  ChatMessageSchema,
} from './schemas/chat-message.schema';
import { ChatArchiveService } from './chat-archive.service';
import { ChatMessagesService } from './chat-messages.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChatMessage.name, schema: ChatMessageSchema },
    ]),
    UsersModule,
  ],
  providers: [ChatArchiveService, ChatMessagesService],
  exports: [ChatArchiveService, ChatMessagesService],
})
export class ChatModule {}
