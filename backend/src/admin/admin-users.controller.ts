import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminUsersService } from './admin-users.service';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { ListUsersQueryDto } from './dto/list-users.query.dto';
import { BanUserDto } from './dto/ban-user.dto';

@Controller('api/admin/users')
@UseGuards(AdminAuthGuard)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  /** Paginated list of normal (non-creator) users. */
  @Get()
  async listUsers(@Query() query: ListUsersQueryDto) {
    const result = await this.adminUsersService.listNormalUsers({
      page: query.page,
      limit: query.limit,
      search: query.search,
      isBanned: query.isBanned,
      isSubscribed: query.isSubscribed,
      gender: query.gender,
    });
    return { success: true, ...result };
  }

  @Get(':id')
  async getUser(@Param('id') id: string) {
    const user = await this.adminUsersService.getUser(id);
    return { success: true, user };
  }

  @Post(':id/ban')
  async banUser(@Param('id') id: string, @Body() body: BanUserDto) {
    const user = await this.adminUsersService.banUser(id, body.reason);
    return { success: true, user };
  }

  @Post(':id/unban')
  async unbanUser(@Param('id') id: string) {
    const user = await this.adminUsersService.unbanUser(id);
    return { success: true, user };
  }
}
