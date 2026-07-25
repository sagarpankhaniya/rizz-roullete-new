import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  CreatorInvite,
  CreatorInviteSchema,
} from './schemas/creator-invite.schema';
import { InvitesService } from './invites.service';
import { InvitesController } from './invites.controller';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CreatorInvite.name, schema: CreatorInviteSchema },
    ]),
    MailModule,
  ],
  controllers: [InvitesController],
  providers: [InvitesService],
  exports: [InvitesService, MongooseModule],
})
export class InvitesModule {}
