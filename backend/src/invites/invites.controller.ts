import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { InvitesService } from './invites.service';
import { CreateCreatorInviteDto } from './dto/create-creator-invite.dto';

@Controller('api/invites')
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  /** Create a one-time creator invite and email the signup link. */
  @Post('creator')
  async createCreatorInvite(@Body() body: CreateCreatorInviteDto) {
    const invite = await this.invitesService.createCreatorInvite(body.email);
    return { success: true, invite };
  }

  /** Validate a pending invite (used to prefill signup). */
  @Get(':inviteId')
  async getInvite(@Param('inviteId') inviteId: string) {
    const invite = await this.invitesService.getPendingInvite(inviteId);
    return { success: true, invite };
  }
}
