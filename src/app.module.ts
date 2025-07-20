import { Module } from '@nestjs/common';
import { LogsModule } from './logs/logs.module';
import { MetricsModule } from './metrics/metrics.module';

@Module({
  imports: [LogsModule, MetricsModule],
})
export class AppModule {}
