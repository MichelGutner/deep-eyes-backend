import { Injectable, Inject } from '@nestjs/common';
import { ESServiceInterface } from '@/modules/elasticsearch';

@Injectable()
export class PerformanceService {
  constructor(
    @Inject('ESService')
    private readonly esService: ESServiceInterface,
  ) {}

  async getPerformanceMetrics(timeRange = '1h') {
    try {
      const result = await this.esService.queryLogs(
        { timeRange },
        'logs-*',
      ) as any;

      const hits = result.hits?.hits ?? [];
      const totalRequests = hits.length;

      const responseTimes = hits.map((h: any) => h._source?.http?.responseTime).filter((v: any) => typeof v === 'number');
      const avgResponseTime = responseTimes.length > 0 ? Math.round(responseTimes.reduce((a: number, b: number) => a + b, 0) / responseTimes.length) : 0;

      const errorResult = await this.esService.queryLogs(
        { level: 'error', timeRange },
        'logs-*',
      ) as any;
      const errorCount = (errorResult.hits?.total as any)?.value ?? 0;

      return {
        timestamp: new Date().toISOString(),
        responseTime: avgResponseTime,
        throughput: totalRequests,
        errorRate: totalRequests > 0
          ? parseFloat(((errorCount / totalRequests) * 100).toFixed(2))
          : 0,
        endpoints: [],
      };
    } catch {
      return {
        timestamp: new Date().toISOString(),
        responseTime: 0,
        throughput: 0,
        errorRate: 0,
        endpoints: [],
      };
    }
  }
}
