import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ESServiceInterface } from './interfaces/es.interface';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import {
  AggregationsAggregate,
  GetResponse,
  SearchResponse,
} from '@elastic/elasticsearch/lib/api/types';
import { Logger } from '@/logger/application';

// logs-{service}-{env}-{yyyy.MM.dd}

@Injectable()
export class ESService implements ESServiceInterface, OnModuleInit {
  constructor(
    private readonly elasticsearchService: ElasticsearchService,
    @Inject('Logger')
    private readonly logger: Logger,
  ) {}
  async onModuleInit() {
    this.createTemplate()
      .then(() =>
        this.logger.log('🟢 - Elasticsearch template created successfully'),
      )
      .catch((error) =>
        this.logger.error('Error creating Elasticsearch template:', error),
      );
    this.createIlmPolicy()
      .then(() => this.logger.log('🟢 - ILM policy created successfully'))
      .catch((error) =>
        this.logger.error('🔴 - Error creating ILM policy:', error),
      );
  }

  createDataStream(name: string) {
    return this.elasticsearchService.indices.createDataStream({
      name,
    });
  }
  /**
   * Indexa um documento no Elasticsearch
   * @param streamName Nome do data stream
   * @param document Documento a ser indexado
   */
  async indexDocument<T>(streamName: string, document: T) {
    const exists = await this.elasticsearchService.indices.exists({
      index: streamName,
    });
    if (!exists) {
      await this.createDataStream(streamName);
    }
    return await this.elasticsearchService.index({
      index: streamName,
      document,
    });
  }

  getStreamDocuments<T>(
    streamName: string,
  ): Promise<SearchResponse<T, Record<string, AggregationsAggregate>>> {
    return this.elasticsearchService.search<T>({
      index: streamName,
      body: {
        query: {
          match_all: {},
        },
        size: 1000,
        sort: [{ timestamp: { order: 'desc' } }],
      },
    });
  }

  getDocument<T>(
    indexName: string,
    id: string,
  ): Promise<GetResponse<T> | null> {
    return this.elasticsearchService.get<T>({
      id,
      index: indexName,
    });
  }

  private async createTemplate() {
    await this.elasticsearchService.indices.putIndexTemplate({
      name: 'logs_template',
      index_patterns: ['logs-*'],
      template: {
        settings: {
          number_of_shards: 1,
          number_of_replicas: 1,
          refresh_interval: '30s',
        },
        mappings: {
          properties: {
            timestamp: { type: 'date' },
            service: { type: 'keyword' },
            level: { type: 'keyword' },
            message: { type: 'text' },
            traceId: { type: 'keyword' },
            spanId: { type: 'keyword' },
            requestId: { type: 'keyword' },
            userId: { type: 'keyword' },
            attributes: { type: 'object' },
          },
        },
      },
    });
  }

  private async createIlmPolicy() {
    await this.elasticsearchService.ilm.putLifecycle({
      name: 'logs_policy',
      policy: {
        phases: {
          hot: {
            actions: {
              rollover: { max_age: '1d', max_size: '25gb' },
            },
          },
          warm: {
            min_age: '7d',
            actions: {
              forcemerge: { max_num_segments: 1 },
            },
          },
          delete: {
            min_age: '90d',
            actions: { delete: {} },
          },
        },
      },
    });
  }
}
