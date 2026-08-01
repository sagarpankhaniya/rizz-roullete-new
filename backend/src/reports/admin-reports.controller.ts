import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminAuthGuard } from '../admin/guards/admin-auth.guard';
import {
  CurrentUser,
  type JwtPayload,
} from '../common/decorators/current-user.decorator';
import { ListReportsQueryDto } from './dto/list-reports.query.dto';
import { ResolveReportDto } from './dto/resolve-report.dto';
import { ReportsService } from './reports.service';

@Controller('api/admin/reports')
@UseGuards(AdminAuthGuard)
export class AdminReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  async listReports(@Query() query: ListReportsQueryDto) {
    const result = await this.reportsService.listReports({
      page: query.page,
      limit: query.limit,
      status: query.status,
      search: query.search,
    });
    return { success: true, ...result };
  }

  @Get(':id')
  async getReport(@Param('id') id: string) {
    const report = await this.reportsService.getReport(id);
    return { success: true, report };
  }

  @Post(':id/dismiss')
  async dismissReport(
    @Param('id') id: string,
    @CurrentUser() admin: JwtPayload,
    @Body() body: ResolveReportDto,
  ) {
    const report = await this.reportsService.dismissReport(
      id,
      admin.userId,
      body.notes,
    );
    return { success: true, report };
  }

  @Post(':id/ban')
  async banFromReport(
    @Param('id') id: string,
    @CurrentUser() admin: JwtPayload,
    @Body() body: ResolveReportDto,
  ) {
    const report = await this.reportsService.banFromReport(id, admin.userId, {
      notes: body.notes,
      banReason: body.banReason,
    });
    return { success: true, report };
  }
}
