import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { AdminAnalyticsService } from './admin-analytics.service';

@Controller('api/admin/analytics')
@UseGuards(AdminAuthGuard)
export class AdminAnalyticsController {
  constructor(private readonly analyticsService: AdminAnalyticsService) {}

  /** Dashboard summary cards + chart series. */
  @Get('dashboard')
  async getDashboard() {
    const data = await this.analyticsService.getDashboardAnalytics();
    return { success: true, ...data };
  }

  /** Day-wise unique visitors for a date range. */
  @Get('visitors')
  async getVisitors(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const data = await this.analyticsService.getVisitorAnalytics({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(`${to}T23:59:59.999`) : undefined,
    });
    return { success: true, ...data };
  }
}
