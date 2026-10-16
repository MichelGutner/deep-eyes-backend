import { Controller, Get, Inject } from '@nestjs/common';
import { Public } from '@/modules/auth/application/decorators/public.decorator';
import { HealthService } from './health.service';

@Public()
@Controller('health')
export class HealthController {
  constructor(
    @Inject('HealthService')
    private readonly healthService: HealthService,
  ) {}

  @Get()
  getHealth() {
    return this.healthService.getHealth();
  }
}
