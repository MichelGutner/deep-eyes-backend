import { Module } from '@nestjs/common';
import { PrismaModule } from '@/modules/prisma';
import { DashboardsController } from './dashboards.controller';

@Module({
  imports: [PrismaModule],
  controllers: [DashboardsController],
})
export class DashboardsModule {}
