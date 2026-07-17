import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiWrappedOkResponse } from '../../common/decorators/api-wrapped-ok.decorator';
import { HealthStatusDto } from './dto/health-status.dto';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({
    summary: 'Liveness/readiness probe',
    description:
      'Checks MongoDB and Redis connectivity. Used by Nginx/PM2 health checks.',
  })
  @ApiWrappedOkResponse(HealthStatusDto)
  getHealth(): Promise<HealthStatusDto> {
    return this.healthService.check();
  }
}
