import { Module } from '@nestjs/common';
import { PrismaModule } from '@/modules/prisma';
import { SettingsController } from './settings.controller';

@Module({
  imports: [PrismaModule],
  controllers: [SettingsController],
})
export class SettingsModule {}
