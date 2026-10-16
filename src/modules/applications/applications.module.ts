import { Module } from '@nestjs/common';
import { ApplicationsController } from './applications.controller';
import { PrismaModule } from '@/modules/prisma';

@Module({
  imports: [PrismaModule],
  controllers: [ApplicationsController],
})
export class ApplicationsModule {}
