import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type JwtPayload,
} from '../common/decorators/current-user.decorator';
import { CreateReportDto } from './dto/create-report.dto';
import { ReportsService } from './reports.service';

@Controller('api/reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  async createReport(
    @CurrentUser() user: JwtPayload,
    @Body() body: CreateReportDto,
  ) {
    return this.reportsService.createReport({
      reporterId: user.userId,
      reportedUserId: body.reportedUserId,
      reason: body.reason,
      details: body.details,
      roomName: body.roomName,
      reportedIdentity: body.reportedIdentity,
    });
  }
}
