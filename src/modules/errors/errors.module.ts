import { Module } from '@nestjs/common';
import { ErrorsController } from './errors.controller';
import { ElasticsearchModule } from '@/modules/elasticsearch';

@Module({
  imports: [ElasticsearchModule],
  controllers: [ErrorsController],
})
export class ErrorsModule {}
