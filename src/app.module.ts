import { Module } from '@nestjs/common';
import { PrismaModule } from './modules';
import { LogsModule } from './modules/logs';
import { KafkaModule } from './modules/kafka';
import { TracingModule } from './modules/tracing';

@Module({
  controllers: [],
  imports: [TracingModule, PrismaModule, LogsModule, KafkaModule],
  providers: [],
})
export class AppModule {}
