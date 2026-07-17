import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  CallSession,
  CallSessionSchema,
} from './schemas/call-session.schema';
import { CallSessionService } from './call-session.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CallSession.name, schema: CallSessionSchema },
    ]),
  ],
  providers: [CallSessionService],
  exports: [CallSessionService],
})
export class CallSessionModule {}

