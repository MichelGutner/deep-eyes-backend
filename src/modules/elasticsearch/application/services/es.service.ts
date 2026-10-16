import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ESServiceInterface, ErrorGroup, LevelAggregation, LogQueryFilters } from './interfaces/es.interface';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import {
  AggregationsAggregate,
  GetResponse,
  QueryDslQueryContainer,
  SearchResponse,
} from '@elastic/elasticsearch/lib/api/types';
import { Logger } from '@/logger/application';

// logs-{service}-{env}-{yyyy.MM.dd}

function parseTimeRange(timeRange: string): number {
  const match = timeRange.match(/^(\d+)([smhdwMy])$/);
  if (!match) return 7 * 24 * 3_600_000;
  const n = Number(match[1]);
  switch (match[2]) {
    case 's': return n * 1_000;
    case 'm': return n * 60_000;
    case 'h': return n * 3_600_000;
    case 'd': return n * 86_400_000;
    case 'w': return n * 7 * 86_400_000;
    case 'M': return n * 30 * 86_400_000;
    case 'y': return n * 365 * 86_400_000;
    default:  return 7 * 86_400_000;
  }
}

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

  async queryLogs<T>(
    filters: LogQueryFilters,
    streamPattern = 'logs-*',
  ): Promise<SearchResponse<T, Record<string, AggregationsAggregate>>> {
    const must: QueryDslQueryContainer[] = [];

    if (filters.level) {
      must.push({ term: { level: filters.level } });
    }
    if (filters.platform) {
      must.push({ term: { platform: filters.platform } });
    }
    if (filters.environment) {
      must.push({ term: { environment: filters.environment } });
    }
    if (filters.app) {
      must.push({ term: { app: filters.app } });
    }
    if (filters.fingerprint) {
      must.push({ term: { fingerprint: filters.fingerprint } });
    }
    if (filters.search) {
      must.push({ multi_match: { query: filters.search, fields: ['message', 'error.message', 'app'] } });
    }
    if (filters.timeRange) {
      must.push({
        range: {
          timestamp: { gte: `now-${filters.timeRange}`, lte: 'now' },
        },
      });
    }

    return this.elasticsearchService.search<T>({
      index: streamPattern,
      body: {
        query: must.length ? { bool: { must } } : { match_all: {} },
        size: filters.limit ?? 100,
        from: filters.offset ?? 0,
        sort: [{ timestamp: { order: 'desc' } }],
      },
    });
  }

  async aggregateLogsByLevel(
    streamPattern = 'logs-*',
    timeRange?: string,
  ): Promise<LevelAggregation[]> {
    const query: QueryDslQueryContainer = timeRange
      ? { range: { timestamp: { gte: `now-${timeRange}`, lte: 'now' } } }
      : { match_all: {} };

    const result = await this.elasticsearchService.search({
      index: streamPattern,
      body: {
        query,
        size: 0,
        aggs: {
          by_level: {
            terms: { field: 'level', size: 10 },
          },
        },
      },
    });

    const buckets = (result.aggregations?.by_level as any)?.buckets ?? [];
    return buckets.map((b: { key: string; doc_count: number }) => ({
      level: b.key,
      sum: b.doc_count,
    }));
  }

  async aggregateErrors(timeRange = '7d', limit = 500): Promise<ErrorGroup[]> {
    try {
      // Busca sem timeRange no ES — filtragem por data feita em memória
      // para evitar problemas com mapeamento do campo timestamp
      const [errResult, fatalResult] = await Promise.all([
        this.queryLogs({ level: 'error', limit: Math.floor(limit / 2) }, 'logs-*'),
        this.queryLogs({ level: 'fatal', limit: Math.floor(limit / 2) }, 'logs-*'),
      ]) as any[];

      const allHits = [
        ...(errResult.hits?.hits ?? []),
        ...(fatalResult.hits?.hits ?? []),
      ];

      // Filtra por timeRange em memória
      const cutoff = timeRange
        ? Date.now() - parseTimeRange(timeRange)
        : 0;

      const errorHits = cutoff > 0
        ? allHits.filter((h: any) => new Date(h._source?.timestamp ?? 0).getTime() >= cutoff)
        : allHits;

      this.logger.log(`aggregateErrors: ${allHits.length} total hits, ${errorHits.length} within ${timeRange}`);

      const map = new Map<string, any[]>();
      for (const hit of errorHits) {
        const src = hit._source ?? {};
        const key = src.fingerprint
          ?? `${src.platform ?? 'unknown'}:${src.error?.name ?? 'UnknownError'}:${src.app ?? 'unknown'}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push({ _id: hit._id, ...src });
      }

      const now = Date.now();
      return Array.from(map.entries()).map(([fp, items]) => {
        const sorted = [...items].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        );
        const platforms = [...new Set(items.map((i: any) => i.platform).filter(Boolean))];
        const apps = [...new Set(items.map((i: any) => i.app).filter(Boolean))];
        const userSet = new Set(items.map((i: any) => i.user?.id).filter(Boolean));
        const hasFatal = items.some((i: any) => i.level === 'fatal');
        const hourly = Array.from({ length: 24 }, (_, h) => {
          const start = now - (24 - h) * 3_600_000;
          const end = start + 3_600_000;
          return items.filter((i: any) => {
            const t = new Date(i.timestamp).getTime();
            return t >= start && t < end;
          }).length;
        });

        return {
          fingerprint: fp,
          errorType: sorted[0].error?.name ?? sorted[0].errorType ?? 'UnknownError',
          message: sorted[0].message,
          platforms,
          apps,
          count: items.length,
          userCount: userSet.size,
          firstSeen: items.reduce(
            (min: string, i: any) => (i.timestamp < min ? i.timestamp : min),
            items[0].timestamp,
          ),
          lastSeen: sorted[0].timestamp,
          level: hasFatal ? 'fatal' : 'error',
          representative: sorted[0],
          hourly,
        } as ErrorGroup;
      }).sort(
        (a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime(),
      );
    } catch (err) {
      this.logger.error('aggregateErrors failed', err);
      return [];
    }
  }

  /**
   * Full chronological history for one error group — every occurrence, oldest first,
   * each carrying its own breadcrumbs/device/tags/metadata/request. aggregateErrors()
   * only ever returns the single latest occurrence (`representative`); this is what
   * backs the incident-timeline view ("what happened leading up to this crash, and
   * has it happened on other devices/releases too").
   */
  async getErrorOccurrences(fingerprint: string, timeRange = '30d', limit = 50): Promise<any[]> {
    try {
      const [errResult, fatalResult] = await Promise.all([
        this.queryLogs({ level: 'error', fingerprint, limit: Math.floor(limit / 2) || 1 }, 'logs-*'),
        this.queryLogs({ level: 'fatal', fingerprint, limit: Math.floor(limit / 2) || 1 }, 'logs-*'),
      ]) as any[];

      const cutoff = timeRange ? Date.now() - parseTimeRange(timeRange) : 0;
      const hits = [...(errResult.hits?.hits ?? []), ...(fatalResult.hits?.hits ?? [])]
        .map((h: any) => ({ _id: h._id, ...h._source }))
        .filter((doc: any) => (cutoff > 0 ? new Date(doc.timestamp ?? 0).getTime() >= cutoff : true))
        .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      return hits;
    } catch (err) {
      this.logger.error('getErrorOccurrences failed', err);
      return [];
    }
  }

  async aggregateActiveUsers(timeRange = '24h'): Promise<number> {
    try {
      const result = await this.elasticsearchService.search({
        index: 'logs-*',
        body: {
          query: timeRange ? { range: { timestamp: { gte: `now-${timeRange}`, lte: 'now' } } } : { match_all: {} },
          size: 0,
          aggs: { unique_users: { cardinality: { field: 'user.id' } } },
        },
      });
      return (result.aggregations?.unique_users as any)?.value ?? 0;
    } catch {
      return 0;
    }
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
