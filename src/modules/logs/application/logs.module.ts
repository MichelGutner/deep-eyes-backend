import { Global, Module, Provider } from '@nestjs/common';
import { LogsService } from './services/logs.service';
import { LogsController } from './controllers/logs.controller';
import { ElasticsearchModule } from '@nestjs/elasticsearch';

const provider: Provider = {
  provide: 'LogsService',
  useClass: LogsService,
};

@Global()
@Module({
  imports: [
    ElasticsearchModule.register({
      node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
      auth: {
        username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
        password: process.env.ELASTICSEARCH_PASSWORD || 'changeme',
      },
      maxRetries: 5,
      requestTimeout: 60000,
    }),
  ],
  controllers: [LogsController],
  providers: [provider],
  exports: [provider],
})
export class LogsModule {}
