import { Module } from '@nestjs/common';
import { PrismaModule } from '@/modules/prisma';
import { IncidentsController } from './incidents.controller';

@Module({
  imports: [PrismaModule],
  controllers: [IncidentsController],
})
export class IncidentsModule {}
