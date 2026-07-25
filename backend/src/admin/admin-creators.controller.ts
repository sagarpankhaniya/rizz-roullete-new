import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminCreatorsService } from './admin-creators.service';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { ListCreatorsQueryDto } from './dto/list-creators.query.dto';
import { BanUserDto } from './dto/ban-user.dto';

@Controller('api/admin/creators')
@UseGuards(AdminAuthGuard)
export class AdminCreatorsController {
  constructor(private readonly adminCreatorsService: AdminCreatorsService) {}

  /**
   * Paginated creator invites.
   * status=invited → just invited (not signed up yet)
   * status=accepted → invite used / account created
   */
  @Get()
  async listCreators(@Query() query: ListCreatorsQueryDto) {
    const result = await this.adminCreatorsService.listCreators({
      page: query.page,
      limit: query.limit,
      search: query.search,
      status: query.status,
    });
    return { success: true, ...result };
  }

  @Get(':id')
  async getCreator(@Param('id') id: string) {
    const creator = await this.adminCreatorsService.getCreator(id);
    return { success: true, creator };
  }

  @Post(':id/ban')
  async banCreator(@Param('id') id: string, @Body() body: BanUserDto) {
    const creator = await this.adminCreatorsService.banCreator(id, body.reason);
    return { success: true, creator };
  }

  @Post(':id/unban')
  async unbanCreator(@Param('id') id: string) {
    const creator = await this.adminCreatorsService.unbanCreator(id);
    return { success: true, creator };
  }
}
