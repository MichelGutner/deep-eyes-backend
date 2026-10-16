import { Injectable, Inject } from '@nestjs/common';
import { ESServiceInterface } from '@/modules/elasticsearch';
import { PrismaService, PRISMA_SERVICE } from '@/modules/prisma';

@Injectable()
export class HealthService {
  constructor(
    @Inject('ESService')
    private readonly esService: ESServiceInterface,
    @Inject(PRISMA_SERVICE)
    private readonly prisma: PrismaService,
  ) {}

  async getHealth() {
    const startTime = process.uptime();
    const checks = await Promise.allSettled([
      this.checkElasticsearch(),
      this.checkDatabase(),
    ]);

    const esStatus = checks[0].status === 'fulfilled' ? 'up' : 'down';
    const dbStatus = checks[1].status === 'fulfilled' ? 'up' : 'down';

    const allUp = esStatus === 'up' && dbStatus === 'up';
    const anyDown = esStatus === 'down' || dbStatus === 'down';

    return {
      status: allUp ? 'healthy' : anyDown ? 'degraded' : 'down',
      uptime: Math.floor(startTime),
      services: {
        elasticsearch: esStatus,
        database: dbStatus,
      },
      timestamp: new Date().toISOString(),
    };
  }

  private async checkElasticsearch(): Promise<void> {
    await this.esService.getStreamDocuments('logs-*');
  }

  private async checkDatabase(): Promise<void> {
    await this.prisma.$queryRaw`SELECT 1`;
  }
}
