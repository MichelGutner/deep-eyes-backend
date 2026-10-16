import { Logger, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from './modules/auth/application/guards/jwt-auth.guard';
import {
  AuthModule,
  LogsModule,
  PrismaModule,
  TracingModule,
  UserModule,
  OrganizationModule,
  ResilienceModule,
  ElasticsearchModule,
  HealthModule,
  PerformanceModule,
  RealtimeModule,
  SecurityModule,
  ApplicationsModule,
  ErrorsModule,
  AlertsModule,
  IncidentsModule,
  CustomMetricsModule,
  DashboardsModule,
  SettingsModule,
  SymbolicationModule,
} from './modules';
import { LoggerModule } from './logger';
import { TelemetryModule } from './modules/shared';

@Module({
  controllers: [],
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    ElasticsearchModule,
    TracingModule,
    LogsModule,
    AuthModule,
    LoggerModule,
    UserModule,
    OrganizationModule,
    ResilienceModule,
    HealthModule,
    PerformanceModule,
    RealtimeModule,
    SecurityModule,
    ApplicationsModule,
    ErrorsModule,
    AlertsModule,
    IncidentsModule,
    CustomMetricsModule,
    DashboardsModule,
    SettingsModule,
    SymbolicationModule,
    TelemetryModule.forRoot({
      kafka: {
        brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
        clientId: process.env.KAFKA_CLIENT_ID,
        groupId: process.env.KAFKA_GROUP_ID || 'default-group-id',
      },
    }),
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
