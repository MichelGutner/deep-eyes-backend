import { Module } from '@nestjs/common';
import { MetricsModule } from './metrics/metrics.module';
import { PrismaModule } from './modules';
import { LogsModule, LogsController } from './modules/logs';
import { ConfigModule } from '@nestjs/config';

@Module({
  controllers: [LogsController],
  imports: [ConfigModule.forRoot(), PrismaModule, LogsModule, MetricsModule],
  providers: [],
})
export class AppModule {}
