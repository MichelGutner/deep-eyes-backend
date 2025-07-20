import { Module } from '@nestjs/common';
import { LogsModule } from './logs/logs.module';
import { MetricsModule } from './metrics/metrics.module';
import { PrismaModule } from './modules';

@Module({
  imports: [PrismaModule, LogsModule, MetricsModule],
})
export class AppModule {}
