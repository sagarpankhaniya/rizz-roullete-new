import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PageVisit, PageVisitSchema } from './schemas/page-visit.schema';
import { VisitsController } from './visits.controller';
import { VisitsService } from './visits.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PageVisit.name, schema: PageVisitSchema },
    ]),
  ],
  controllers: [VisitsController],
  providers: [VisitsService],
  exports: [VisitsService],
})
export class VisitsModule {}
