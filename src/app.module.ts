import { Module } from '@nestjs/common';
import {
  AuthModule,
  KafkaModule,
  LogsModule,
  PrismaModule,
  TracingModule,
  UserModule,
} from './modules';
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
    UserModule,
  ],
  providers: [],
})
export class AppModule {}
