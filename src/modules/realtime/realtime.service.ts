import { Injectable, Inject } from '@nestjs/common';
import { ESServiceInterface } from '@/modules/elasticsearch';

@Injectable()
export class RealtimeService {
  constructor(
    @Inject('ESService')
    private readonly esService: ESServiceInterface,
  ) {}

  async getRealtimeMetrics(timeRange = '1m') {
    try {
      const result = await this.esService.queryLogs(
        { timeRange, limit: 20 },
        'logs-*',
      ) as any;

      const errorResult = await this.esService.queryLogs(
        { level: 'error', timeRange },
        'logs-*',
      ) as any;

      const total = (result.hits?.total as any)?.value ?? result.hits?.hits?.length ?? 0;
      const errorCount = (errorResult.hits?.total as any)?.value ?? 0;

      return {
        activeUsers: 0,
        requestsPerMin: total,
        errorsLastMinute: errorCount,
        avgResponseTime: 0,
        events: (result.hits?.hits ?? []).map((h: any) => ({
          id: h._id,
          timestamp: h._source?.timestamp,
          level: h._source?.level,
          message: h._source?.message,
          app: h._source?.app,
          platform: h._source?.platform,
        })),
      };
    } catch {
      return {
        activeUsers: 0,
        requestsPerMin: 0,
        errorsLastMinute: 0,
        avgResponseTime: 0,
        events: [],
      };
    }
  }
}
