import { Module } from '@nestjs/common';
import {
  AuthModule,
  KafkaModule,
  LogsModule,
  PrismaModule,
  TracingModule,
  UserModule,
  OrganizationModule
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
    OrganizationModule,
  ],
  providers: [],
})
export class AppModule {}
