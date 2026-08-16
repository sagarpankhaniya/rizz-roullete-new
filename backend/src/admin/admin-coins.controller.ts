import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { AdminCoinsService } from './admin-coins.service';
import { ListAdminCoinTransactionsQueryDto } from './dto/list-coin-transactions.query.dto';

@Controller('api/admin/coins')
@UseGuards(AdminAuthGuard)
export class AdminCoinsController {
  constructor(private readonly adminCoinsService: AdminCoinsService) {}

  @Get('transactions')
  async listTransactions(@Query() query: ListAdminCoinTransactionsQueryDto) {
    const result = await this.adminCoinsService.listTransactions(query);
    return { success: true, ...result };
  }

  @Get('summary')
  async getSummary() {
    const summary = await this.adminCoinsService.getPlatformSummary();
    return { success: true, ...summary };
  }

  @Get('creators/:userId/earnings')
  async getCreatorEarnings(@Param('userId') userId: string) {
    const earnings = await this.adminCoinsService.getCreatorEarnings(userId);
    return { success: true, ...earnings };
  }
}
