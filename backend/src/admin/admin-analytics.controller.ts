import { Controller, Get, UseGuards } from '@nestjs/common';
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
}
