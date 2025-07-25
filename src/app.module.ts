import { Module } from '@nestjs/common';
import { MetricsModule } from './metrics/metrics.module';
import { PrismaModule } from './modules';
import { LogsModule } from './modules/logs';
import { QueueModule } from './modules/queue';

@Module({
  controllers: [],
  imports: [PrismaModule, LogsModule, MetricsModule, QueueModule],
  providers: [],
})
export class AppModule {}
