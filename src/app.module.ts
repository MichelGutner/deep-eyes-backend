import { Module } from '@nestjs/common';
import {
  AuthModule,
  LogsModule,
  PrismaModule,
  TracingModule,
  UserModule,
  OrganizationModule,
  ResilienceModule
} from './modules';
import { LoggerModule } from './logger';
import { TelemetryModule } from './modules/shared';

@Module({
  controllers: [],
  imports: [
    TracingModule,
    PrismaModule,
    LogsModule,
    AuthModule,
    // LoggerModule,
    UserModule,
    OrganizationModule,
    ResilienceModule,
    TelemetryModule.forRoot({
      kafka: {
        brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
        clientId: process.env.KAFKA_CLIENT_ID,
        groupId: process.env.KAFKA_GROUP_ID || 'default-group-id',
      },
    }),
  ],
  providers: [],
})
export class AppModule {}
