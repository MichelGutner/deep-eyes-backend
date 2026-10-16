import { Controller, Get, Inject, Query } from '@nestjs/common';
import { SecurityService } from './security.service';

@Controller('security')
export class SecurityController {
  constructor(
    @Inject('SecurityService')
    private readonly securityService: SecurityService,
  ) {}

  @Get()
  getSecurity(@Query('timeRange') timeRange = '24h') {
    return this.securityService.getSecurityEvents(timeRange);
  }
}
