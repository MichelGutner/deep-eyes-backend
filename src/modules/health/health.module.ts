import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PrismaModule } from '@/modules/prisma';

@Module({
  imports: [PrismaModule],
  controllers: [HealthController],
  providers: [
    {
      provide: 'HealthService',
      useClass: HealthService,
    },
  ],
})
export class HealthModule {}
