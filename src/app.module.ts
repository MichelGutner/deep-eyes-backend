import { Module } from '@nestjs/common';
import { MetricsModule } from './metrics/metrics.module';
import { PrismaModule } from './modules';
import { LogsModule, LogsController } from './modules/logs';

@Module({
  controllers: [LogsController],
  imports: [PrismaModule, LogsModule, MetricsModule],
  providers: [],
})
export class AppModule {}
