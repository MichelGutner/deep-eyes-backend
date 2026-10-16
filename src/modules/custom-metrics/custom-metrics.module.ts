import { Module } from '@nestjs/common';
import { PrismaModule } from '@/modules/prisma';
import { ElasticsearchModule } from '@/modules/elasticsearch';
import { CustomMetricsController } from './custom-metrics.controller';

@Module({
  imports: [PrismaModule, ElasticsearchModule],
  controllers: [CustomMetricsController],
})
export class CustomMetricsModule {}
