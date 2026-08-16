import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CoinsService } from './coins.service';
import { BuyCoinsDto } from './dto/buy-coins.dto';
import { EnterCreatorRoomDto } from './dto/enter-room.dto';
import { SpendCoinsDto } from './dto/spend-coins.dto';
import { ListCoinTransactionsQueryDto } from './dto/list-transactions.query.dto';
import { CREATOR_ENTRY_FEE } from './coins.constants';

@Controller('api/coins')
@UseGuards(JwtAuthGuard)
export class CoinsController {
  constructor(private readonly coinsService: CoinsService) {}

  @Get('balance')
  async getBalance(@Req() req: any) {
    return this.coinsService.getBalance(req.user.userId);
  }

  @Get('entry-fee')
  getEntryFee() {
    return { entryFee: CREATOR_ENTRY_FEE };
  }

  @Get('earnings')
  async getEarnings(@Req() req: any) {
    return this.coinsService.getCreatorEarnings(req.user.userId);
  }

  @Get('transactions')
  async getTransactions(
    @Req() req: any,
    @Query() query: ListCoinTransactionsQueryDto,
  ) {
    const result = await this.coinsService.getUserTransactions(
      req.user.userId,
      query.page,
      query.limit,
    );
    return { success: true, ...result };
  }

  @Post('buy')
  async buyCoins(@Req() req: any, @Body() body: BuyCoinsDto) {
    return this.coinsService.buyCoins(req.user.userId, body);
  }

  @Post('enter-room')
  async enterCreatorRoom(@Req() req: any, @Body() body: EnterCreatorRoomDto) {
    return this.coinsService.enterCreatorRoom(req.user.userId, body.creatorId);
  }

  @Post('spend')
  async spendCoins(@Req() req: any, @Body() body: SpendCoinsDto) {
    return this.coinsService.spendCoins(
      req.user.userId,
      body.amount,
      body.creatorId,
    );
  }
}
