import { Injectable, Inject } from '@nestjs/common';
import { ESServiceInterface } from '@/modules/elasticsearch';

@Injectable()
export class SecurityService {
  constructor(
    @Inject('ESService')
    private readonly esService: ESServiceInterface,
  ) {}

  async getSecurityEvents(timeRange = '24h') {
    try {
      const result = await this.esService.queryLogs(
        { level: 'error', timeRange, limit: 50 },
        'logs-*',
      ) as any;

      const events = (result.hits?.hits ?? []).map((h: any) => {
        const src = h._source ?? {};
        return {
          id: h._id,
          timestamp: src.timestamp,
          type: src.http?.statusCode === 401 || src.http?.statusCode === 403
            ? 'access_denied'
            : 'suspicious_activity',
          severity: src.level === 'fatal' ? 'critical' : 'high',
          user: src.user?.email ?? src.user?.id ?? 'unknown',
          ip: src.user?.ip ?? src.request?.ip ?? 'unknown',
          action: src.http?.method ?? 'unknown',
          resource: src.http?.url ?? src.message ?? 'unknown',
          status: 'investigating',
        };
      });

      return { events };
    } catch {
      return { events: [] };
    }
  }
}
