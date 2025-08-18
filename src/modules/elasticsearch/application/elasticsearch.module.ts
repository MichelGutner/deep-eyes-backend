import { Global, Module, Provider } from '@nestjs/common';
import {
  ElasticsearchService,
  ElasticsearchModule as ESModule,
} from '@nestjs/elasticsearch';
import { ESService } from './services/es.service';

const providers: Provider[] = [
  {
    provide: 'ESService',
    useClass: ESService,
  },
  {
    provide: 'ElasticsearchService',
    useExisting: ElasticsearchService,
  },
];

@Global()
@Module({
  imports: [
    ESModule.register({
      node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
      auth: {
        username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
        password: process.env.ELASTICSEARCH_PASSWORD || 'changeme',
      },
      maxRetries: 5,
      requestTimeout: 60000,
      redaction: {
        type: 'replace',
        additionalKeys: ['password', 'secret'],
      },
    }),
  ],
  controllers: [],
  providers: [...providers],
  exports: [...providers],
})
export class ElasticsearchModule {}
