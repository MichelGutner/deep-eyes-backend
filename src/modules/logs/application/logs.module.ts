import { Global, Module, Provider } from '@nestjs/common';
import { LogsService } from './services/logs.service';
import { LogsController } from './controllers/logs.controller';
import { LogsProcessorService } from './services/logs-processor.service';
import { LogsConsumerController } from './controllers/logs-consumer.controller';
import { ElasticsearchModule, ESService } from '@/modules/elasticsearch';

const providers: Provider[] = [
  {
    provide: 'LogsService',
    useClass: LogsService,
  },
  LogsProcessorService,
];

@Module({
  imports: [],
  controllers: [LogsController, LogsConsumerController],
  providers: [...providers],
  exports: [...providers],
})
export class LogsModule {}
