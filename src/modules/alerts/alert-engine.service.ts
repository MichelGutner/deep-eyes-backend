import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PRISMA_SERVICE } from '@/modules/prisma';
import { PrismaService } from '@/modules/prisma/application/services/prisma.service';
import { ESServiceInterface } from '@/modules/elasticsearch';

const CHECK_INTERVAL_MS = 60_000;

@Injectable()
export class AlertEngineService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AlertEngineService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @Inject(PRISMA_SERVICE)
    private readonly prisma: PrismaService,
    @Inject('ESService')
    private readonly esService: ESServiceInterface,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => this.runChecks(), CHECK_INTERVAL_MS);
    // Run once on startup after a short delay
    setTimeout(() => this.runChecks(), 5_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async runChecks() {
    const rules = await this.prisma.alertRule.findMany({ where: { enabled: true } });
    if (rules.length === 0) return;

    await Promise.allSettled(rules.map(rule => this.evaluateRule(rule)));
  }

  private async evaluateRule(rule: { id: string; name: string; metric: string; threshold: number; condition: string; severity: string; notifications: any }) {
    try {
      const value = await this.getMetricValue(rule.metric);
      if (value === null) return;

      const violated = this.isViolated(value, rule.threshold, rule.condition);
      if (!violated) return;

      // Avoid duplicate alerts: skip if an active alert for this rule was created in the last 10min
      const recentAlert = await this.prisma.alert.findFirst({
        where: {
          source: `rule:${rule.id}`,
          status: { in: ['active', 'acknowledged'] },
          created_at: { gte: new Date(Date.now() - 10 * 60_000) },
        },
      });
      if (recentAlert) return;

      const newAlert = await this.prisma.alert.create({
        data: {
          type: 'error',
          title: `Alert: ${rule.name}`,
          message: `${rule.metric} = ${value.toFixed(2)} (threshold: ${rule.threshold}, condition: ${rule.condition})`,
          severity: rule.severity,
          status: 'active',
          source: `rule:${rule.id}`,
          tags: [rule.metric, 'automated'],
        },
      });

      this.logger.warn(`Alert fired for rule "${rule.name}" — ${rule.metric}=${value}`);

      // Send webhook if configured
      const notif = (rule.notifications as any) ?? {};
      if (notif.webhookUrl) {
        await this.sendWebhook(notif.webhookUrl, {
          event: 'alert.fired',
          rule: { id: rule.id, name: rule.name, severity: rule.severity },
          alert: { title: newAlert.title, message: newAlert.message, severity: rule.severity },
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      this.logger.error(`Rule evaluation failed for "${rule.name}"`, err);
    }
  }

  private async sendWebhook(url: string, payload: any): Promise<void> {
    try {
      const isHttps = url.startsWith('https');
      const mod = await import(isHttps ? 'https' : 'http');
      const body = JSON.stringify(payload);
      await new Promise<void>((resolve, reject) => {
        const parsed = new URL(url);
        const req = (mod as any).request({
          hostname: parsed.hostname,
          port: parsed.port || (isHttps ? 443 : 80),
          path: parsed.pathname + parsed.search,
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        }, (res: any) => {
          res.resume();
          resolve();
        });
        req.on('error', reject);
        req.write(body);
        req.end();
      });
    } catch (err) {
      this.logger.error(`Webhook delivery failed to ${url}: ${err.message}`);
    }
  }

  private async getMetricValue(metric: string): Promise<number | null> {
    // error_rate: % of error logs in the last 5 minutes
    if (metric === 'error_rate') {
      const [errResult, allResult] = await Promise.all([
        this.esService.queryLogs({ level: 'error', timeRange: '5m', limit: 0 }) as any,
        this.esService.queryLogs({ timeRange: '5m', limit: 0 }) as any,
      ]);
      const errors = errResult?.hits?.total?.value ?? 0;
      const total  = allResult?.hits?.total?.value ?? 0;
      return total === 0 ? 0 : (errors / total) * 100;
    }

    // error_count: raw count of errors in last 5 minutes
    if (metric === 'error_count') {
      const result = await this.esService.queryLogs({ level: 'error', timeRange: '5m', limit: 0 }) as any;
      return result?.hits?.total?.value ?? 0;
    }

    // response_time: avg responseTime from http logs last 5 minutes (requires custom agg — skip for now)
    return null;
  }

  private isViolated(value: number, threshold: number, condition: string): boolean {
    if (condition.includes('>')) return value > threshold;
    if (condition.includes('<')) return value < threshold;
    return false;
  }
}
