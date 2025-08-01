import { Module } from '@nestjs/common';
import { PrismaModule } from './modules';
import { LogsModule } from './modules/logs';
import { KafkaModule } from './modules/kafka';
import { TracingModule } from './modules/tracing';
import { AuthModule } from './modules/auth';
import { LoggerModule } from './logger';

@Module({
  controllers: [],
  imports: [
    TracingModule,
    PrismaModule,
    LogsModule,
    KafkaModule,
    AuthModule,
    LoggerModule,
  ],
  providers: [],
})
export class AppModule {}
