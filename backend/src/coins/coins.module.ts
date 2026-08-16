import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/schemas/user.schema';
import { UsersModule } from '../users/users.module';
import { CreatorsModule } from '../creators/creators.module';
import {
  CoinTransaction,
  CoinTransactionSchema,
} from './schemas/coin-transaction.schema';
import { CoinTransactionsService } from './coin-transactions.service';
import { CoinsController } from './coins.controller';
import { CoinsService } from './coins.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: CoinTransaction.name, schema: CoinTransactionSchema },
    ]),
    CreatorsModule,
    UsersModule,
  ],
  controllers: [CoinsController],
  providers: [CoinsService, CoinTransactionsService],
  exports: [CoinsService, CoinTransactionsService],
})
export class CoinsModule {}
