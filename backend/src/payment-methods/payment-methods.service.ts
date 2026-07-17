import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PaymentMethod,
  PaymentMethodDocument,
} from './schemas/payment-method.schema';

@Injectable()
export class PaymentMethodsService {
  constructor(
    @InjectModel(PaymentMethod.name)
    private readonly paymentMethodModel: Model<PaymentMethodDocument>,
  ) {}

  findDefaultByUserId(userId: string) {
    return this.paymentMethodModel.findOne({ userId, isDefault: true }).exec();
  }

  async upsertDefaultForUser(
    userId: string,
    data: { nameOnCard: string; cardNumber: string; cardExpiry: string },
  ): Promise<PaymentMethodDocument> {
    await this.paymentMethodModel
      .updateMany({ userId, isDefault: true }, { isDefault: false })
      .exec();

    return this.paymentMethodModel
      .findOneAndUpdate(
        { userId, cardNumber: data.cardNumber },
        {
          userId,
          nameOnCard: data.nameOnCard,
          cardNumber: data.cardNumber,
          cardExpiry: data.cardExpiry,
          isDefault: true,
        },
        { new: true, upsert: true },
      )
      .exec();
  }
}
