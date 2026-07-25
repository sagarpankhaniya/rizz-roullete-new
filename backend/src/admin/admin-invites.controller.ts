import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { InvitesService } from '../invites/invites.service';
import { CreateCreatorInviteDto } from '../invites/dto/create-creator-invite.dto';
import { AdminAuthGuard } from './guards/admin-auth.guard';

@Controller('api/admin/invites')
@UseGuards(AdminAuthGuard)
export class AdminInvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  /** Create a one-time creator invite and email the signup link. */
  @Post('creator')
  async createCreatorInvite(@Body() body: CreateCreatorInviteDto) {
    const invite = await this.invitesService.createCreatorInvite(body.email);
    return { success: true, invite };
  }
}
