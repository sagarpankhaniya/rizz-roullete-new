import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreatorsService } from '../creators/creators.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import { BuyCoinsDto } from './dto/buy-coins.dto';
import {
  CREATOR_ENTRY_FEE,
  CREATOR_ENTRY_SHARE,
  CREATOR_TIP_SHARE,
} from './coins.constants';
import { CoinTransactionsService } from './coin-transactions.service';

@Injectable()
export class CoinsService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly creatorsService: CreatorsService,
    private readonly transactions: CoinTransactionsService,
  ) {}

  async buyCoins(userId: string, data: BuyCoinsDto) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.coins = (user.coins || 0) + data.amount;
    await user.save();

    await this.transactions.record({
      type: 'purchase',
      userId,
      amount: data.amount,
      platformAmount: data.amount,
      balanceAfter: user.coins,
      note: data.packLabel?.trim() || data.packId,
    });

    return {
      success: true,
      newBalance: user.coins,
      message: `${data.amount} coins added to your wallet.`,
    };
  }

  async getBalance(userId: string) {
    const user = await this.userModel.findById(userId).select('coins');
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return { balance: user.coins || 0 };
  }

  async getCreatorEarnings(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .select('isVip creatorEarnings');
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!user.isVip) {
      throw new ForbiddenException('Creator earnings are for VIP accounts only');
    }

    const summary = await this.transactions.getCreatorEarningsSummary(userId);
    return {
      lifetimeEarnings: user.creatorEarnings || 0,
      ...summary,
    };
  }

  async getUserTransactions(userId: string, page?: number, limit?: number) {
    return this.transactions.listForUser(userId, page, limit);
  }

  async enterCreatorRoom(userId: string, creatorId: string) {
    if (userId === creatorId) {
      throw new BadRequestException('Cannot enter your own room');
    }

    const resolvedCreatorId =
      await this.creatorsService.resolveCreatorUserId(creatorId);
    if (!resolvedCreatorId) {
      throw new BadRequestException({
        code: 'CREATOR_NOT_LIVE',
        message:
          'This creator is not live yet. You can browse for free — check back when she goes online.',
      });
    }

    const [user, creator] = await Promise.all([
      this.userModel.findById(userId),
      this.userModel.findById(resolvedCreatorId),
    ]);

    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!creator || !creator.isVip || creator.isBanned) {
      throw new NotFoundException('Creator not found');
    }

    const creatorOnline = await this.creatorsService.isCreatorOnline(
      resolvedCreatorId,
    );
    if (!creatorOnline) {
      throw new BadRequestException({
        code: 'CREATOR_OFFLINE',
        message: `${creator.firstName} is offline right now. Come back when she goes live — you won't be charged.`,
      });
    }

    const balance = user.coins || 0;
    if (balance < CREATOR_ENTRY_FEE) {
      throw new BadRequestException({
        code: 'INSUFFICIENT_COINS',
        message: `You need ${CREATOR_ENTRY_FEE} coins to enter this room.`,
        required: CREATOR_ENTRY_FEE,
        balance,
      });
    }

    const creatorAmount = Math.floor(CREATOR_ENTRY_FEE * CREATOR_ENTRY_SHARE);
    const platformAmount = CREATOR_ENTRY_FEE - creatorAmount;

    user.coins = balance - CREATOR_ENTRY_FEE;
    creator.creatorEarnings =
      (creator.creatorEarnings || 0) + creatorAmount;

    await Promise.all([user.save(), creator.save()]);

    await this.transactions.record({
      type: 'entry_fee',
      userId,
      creatorId: resolvedCreatorId,
      amount: CREATOR_ENTRY_FEE,
      creatorAmount,
      platformAmount,
      balanceAfter: user.coins,
      counterpartyName: creator.firstName,
      note: 'Room entry',
    });

    return {
      success: true,
      newBalance: user.coins,
      entryFee: CREATOR_ENTRY_FEE,
      creatorId: resolvedCreatorId,
      creatorName: creator.firstName,
    };
  }

  async spendCoins(
    userId: string,
    amount: number,
    creatorId?: string,
    note?: string,
  ) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const balance = user.coins || 0;
    if (balance < amount) {
      throw new BadRequestException({
        code: 'INSUFFICIENT_COINS',
        message: 'Insufficient coins',
        balance,
      });
    }

    user.coins = balance - amount;
    await user.save();

    let creatorReceived = 0;
    let platformAmount = amount;
    let counterpartyName: string | null = null;
    if (creatorId) {
      const creator = await this.userModel.findById(creatorId);
      if (creator && creator.isVip && !creator.isBanned) {
        creatorReceived = Math.floor(amount * CREATOR_TIP_SHARE);
        platformAmount = amount - creatorReceived;
        creator.creatorEarnings =
          (creator.creatorEarnings || 0) + creatorReceived;
        counterpartyName = creator.firstName;
        await creator.save();
      }
    }

    await this.transactions.record({
      type: 'tip',
      userId,
      creatorId: creatorId ?? null,
      amount,
      creatorAmount: creatorReceived,
      platformAmount,
      balanceAfter: user.coins,
      counterpartyName,
      note: note?.trim().slice(0, 200) || null,
    });

    return {
      success: true,
      newBalance: user.coins,
      creatorReceived,
    };
  }

  async sendTip(
    fromUserId: string,
    toUserId: string,
    amount: number,
    menuItem?: string,
  ) {
    if (amount < 1) {
      throw new BadRequestException('Invalid tip amount');
    }
    return this.spendCoins(fromUserId, amount, toUserId, menuItem);
  }
}
