import { Controller, Get, Inject, Query } from '@nestjs/common';
import { PerformanceService } from './performance.service';

@Controller('performance')
export class PerformanceController {
  constructor(
    @Inject('PerformanceService')
    private readonly performanceService: PerformanceService,
  ) {}

  @Get()
  getPerformance(@Query('timeRange') timeRange = '1h') {
    return this.performanceService.getPerformanceMetrics(timeRange);
  }
}
