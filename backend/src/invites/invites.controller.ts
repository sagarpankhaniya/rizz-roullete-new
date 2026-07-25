import { Controller, Get, Param } from '@nestjs/common';
import { InvitesService } from './invites.service';

@Controller('api/invites')
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  /** Validate a pending invite (used to prefill signup). Public. */
  @Get(':inviteId')
  async getInvite(@Param('inviteId') inviteId: string) {
    const invite = await this.invitesService.getPendingInvite(inviteId);
    return { success: true, invite };
  }
}
