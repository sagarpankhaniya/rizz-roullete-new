import { Injectable, NotFoundException } from '@nestjs/common';
import { CoinTransactionsService } from '../coins/coin-transactions.service';
import { CoinTxType } from '../coins/schemas/coin-transaction.schema';
import { UsersService } from '../users/users.service';

@Injectable()
export class AdminCoinsService {
  constructor(
    private readonly transactions: CoinTransactionsService,
    private readonly usersService: UsersService,
  ) {}

  async listTransactions(query: {
    page?: number;
    limit?: number;
    type?: CoinTxType;
    category?: 'purchases' | 'creator_earnings';
    creatorId?: string;
    userId?: string;
    search?: string;
  }) {
    const result = await this.transactions.listAdmin(query);
    return result;
  }

  async getPlatformSummary() {
    return this.transactions.getPlatformSummary();
  }

  async getCreatorEarnings(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user || !user.isVip) {
      throw new NotFoundException('Creator not found');
    }

    const summary = await this.transactions.getCreatorEarningsSummary(userId);
    return {
      creator: {
        id: String(user._id),
        firstName: user.firstName,
        email: user.email,
        creatorEarnings: user.creatorEarnings || 0,
        walletCoins: user.coins || 0,
      },
      ...summary,
    };
  }
}
