import { Module } from '@nestjs/common';
import { PerformanceController } from './performance.controller';
import { PerformanceService } from './performance.service';
import { AuthModule } from '../auth';

@Module({
  imports: [AuthModule],
  controllers: [PerformanceController],
  providers: [
    {
      provide: 'PerformanceService',
      useClass: PerformanceService,
    },
  ],
})
export class PerformanceModule {}
