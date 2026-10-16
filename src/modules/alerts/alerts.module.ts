import { Module } from '@nestjs/common';
import { PrismaModule } from '@/modules/prisma';
import { ElasticsearchModule } from '@/modules/elasticsearch';
import { AlertsController } from './alerts.controller';
import { AlertEngineService } from './alert-engine.service';

@Module({
  imports: [PrismaModule, ElasticsearchModule],
  controllers: [AlertsController],
  providers: [AlertEngineService],
})
export class AlertsModule {}
