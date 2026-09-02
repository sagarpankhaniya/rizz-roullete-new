import { Body, Controller, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import {
  getClientIp,
  getUserAgent,
} from '../common/utils/request-meta.util';
import { RecordVisitDto } from './dto/record-visit.dto';
import { VisitsService } from './visits.service';

@Controller('api/visits')
export class VisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  @Post()
  async recordVisit(@Body() body: RecordVisitDto, @Req() req: Request) {
    const result = await this.visitsService.recordVisit({
      sessionId: body.sessionId,
      path: body.path,
      referrer: body.referrer ?? null,
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
    });

    return { success: true, ...result };
  }
}
