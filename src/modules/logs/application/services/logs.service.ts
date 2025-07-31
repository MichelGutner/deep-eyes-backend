/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Body, Inject, Injectable, Logger } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { SeverityNumber } from '@opentelemetry/api-logs';
import {
  LogContract,
  LogContractFactory,
  //   ErrorLogContract,
  //   AuditLogContract,
  //   SecurityLogContract,
  //   PerformanceLogContract,
  //   IntegrationLogContract,
} from '../../domain';
import { Request } from 'express';
import { LogApplicationInputDto } from '../dtos';
import { TracingServiceInterface } from '@/modules/tracing';
import { KafkaServiceInterface } from '@/modules/kafka';

@Injectable()
export class LogsService {
  private readonly logger = new Logger(LogsService.name);
  private readonly tracer = trace.getTracer('deep-eyes-backend');

  constructor(
    @Inject('KafkaService')
    private readonly producerService: KafkaServiceInterface,
    @Inject('TracingService')
    private readonly tracingService: TracingServiceInterface,
    private readonly elasticsearchService: ElasticsearchService,
  ) {}

  async traceAndPrepareLog(
    log: LogContract,
    request?: Request,
  ): Promise<LogContract | undefined> {
    log.service = this.getServiceInfo();
    log.indentifier = this.getIndexName(log);
    return await this.tracingService.traceHttpRequestLog(request!, log);
  }

  /**
   * Cria e salva log de aplicação
   */
  async logApplication(
    props: LogApplicationInputDto,
    request: Request,
  ): Promise<void> {
    const applicationLog = LogContractFactory.createApplicationLog(props);
    const enrichedLog = await this.traceAndPrepareLog(applicationLog, request);

    this.producerService
      .publishEvent({
        topic: process.env.KAFKA_LOGS_TOPIC || 'logs',
        body: enrichedLog,
      })
      .subscribe({
        next: () => {
          this.logger.log('Application log published successfully');
        },
        error: (error) => {
          this.logger.error('Failed to publish application log', error);
        },
      });
  }

  /**
   * Cria e salva log de erro
   */
  // async logError(
  //   error: Error,
  //   context: ErrorLogContract['context'],
  //   attributes: Record<string, any> = {},
  // ): Promise<void> {
  //   const log = LogContractFactory.createErrorLog(error, context, attributes);
  //   await this.traceAndPrepareLog(log);
  // }

  // /**
  //  * Cria e salva log de performance
  //  */
  // async logPerformance(
  //   operation: string,
  //   component: string,
  //   duration: number,
  //   attributes: Record<string, any> = {},
  // ): Promise<void> {
  //   const log = LogContractFactory.createPerformanceLog(
  //     operation,
  //     component,
  //     duration,
  //     attributes,
  //   );
  //   await this.traceAndPrepareLog(log);
  // }

  // /**
  //  * Cria e salva log de auditoria
  //  */
  // async logAudit(
  //   action: string,
  //   resource: AuditLogContract['resource'],
  //   user: AuditLogContract['user'],
  //   attributes: Record<string, any> = {},
  // ): Promise<void> {
  //   const log = LogContractFactory.createAuditLog(
  //     action,
  //     resource,
  //     user,
  //     attributes,
  //   );
  //   await this.traceAndPrepareLog(log);
  // }

  // /**
  //  * Cria e salva log de segurança
  //  */
  // async logSecurity(
  //   event: SecurityLogContract['event'],
  //   user: SecurityLogContract['user'],
  //   ip: string,
  //   success: boolean,
  //   attributes: Record<string, any> = {},
  // ): Promise<void> {
  //   const log = LogContractFactory.createSecurityLog(
  //     event,
  //     user,
  //     ip,
  //     success,
  //     attributes,
  //   );
  //   await this.traceAndPrepareLog(log);
  // }

  // /**
  //  * Cria e salva log de integração
  //  */
  // async logIntegration(
  //   provider: string,
  //   operation: string,
  //   duration: number,
  //   success: boolean,
  //   attributes: Record<string, any> = {},
  // ): Promise<void> {
  //   const log = LogContractFactory.createIntegrationLog(
  //     provider,
  //     operation,
  //     duration,
  //     success,
  //     attributes,
  //   );
  //   await this.traceAndPrepareLog(log);
  // }

  /**
   * Busca logs no Elasticsearch
   */
  async searchLogs(query: any, index?: string, size: number = 100) {
    return this.tracer.startActiveSpan('logs.search', async (span) => {
      try {
        span.setAttribute('logs.search.size', size);
        span.setAttribute('logs.search.index', index || 'all');

        const result = await this.elasticsearchService.search<LogContract>({
          index,
          body: {
            // query,
            size,
            sort: [{ timestamp: { order: 'desc' } }],
          },
        });

        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message,
        });
        this.logger.error('Failed to search logs', error.stack);
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Busca logs por tipo
   */
  async searchLogsByType(
    type: LogContract['type'],
    query: any = {},
    size: number = 100,
  ): Promise<any> {
    const typeQuery = {
      bool: {
        must: [{ term: { type } }, query],
      },
    };
    return this.searchLogs(typeQuery, `logs-${type}`, size);
  }

  /**
   * Busca logs de erro
   */
  async searchErrorLogs(query: any = {}, size: number = 100): Promise<any> {
    return this.searchLogsByType('error', query, size);
  }

  /**
   * Busca logs de performance
   */
  async searchPerformanceLogs(
    query: any = {},
    size: number = 100,
  ): Promise<any> {
    return this.searchLogsByType('performance', query, size);
  }

  // /**
  //  * Busca logs de auditoria
  //  */
  // async searchAuditLogs(query: any = {}, size: number = 100): Promise<any> {
  //   return this.searchLogsByType('audit', query, size);
  // }

  // /**
  //  * Busca logs de segurança
  //  */
  // async searchSecurityLogs(query: any = {}, size: number = 100): Promise<any> {
  //   return this.searchLogsByType('security', query, size);
  // }

  /**
   * Busca logs por período
   */
  async searchLogsByTimeRange(
    startTime: string,
    endTime: string,
    type?: LogContract['type'],
    size: number = 100,
  ): Promise<any> {
    const timeQuery = {
      range: {
        timestamp: {
          gte: startTime,
          lte: endTime,
        },
      },
    };

    if (type) {
      return this.searchLogsByType(type, timeQuery, size);
    }

    return this.searchLogs(timeQuery, undefined, size);
  }

  /**
   * Busca logs por severity
   */
  async searchLogsBySeverity(
    severity: SeverityNumber,
    type?: LogContract['type'],
    size: number = 100,
  ): Promise<any> {
    const severityQuery = {
      term: { severity },
    };

    if (type) {
      return this.searchLogsByType(type, severityQuery, size);
    }

    return this.searchLogs(severityQuery, undefined, size);
  }

  /**
   * Busca logs por trace ID
   */
  async searchLogsByTraceId(traceId: string): Promise<any> {
    const traceQuery = {
      term: { 'trace.traceId': traceId },
    };
    return this.searchLogs(traceQuery);
  }

  /**
   * Busca logs por request ID
   */
  async searchLogsByRequestId(requestId: string): Promise<any> {
    const requestQuery = {
      term: { 'context.requestId': requestId },
    };
    return this.searchLogs(requestQuery);
  }

  /**
   * Obtém estatísticas dos logs
   */
  async getLogStats(timeRange?: { start: string; end: string }): Promise<any> {
    return this.tracer.startActiveSpan('logs.stats', async (span) => {
      try {
        const query: any = {};
        if (timeRange) {
          query.range = {
            timestamp: {
              gte: timeRange.start,
              lte: timeRange.end,
            },
          };
        }

        const result = await this.elasticsearchService.search({
          index: 'logs-*',
          body: {
            query,
            aggs: {
              log_types: {
                terms: { field: 'type' },
              },
              severity_levels: {
                terms: { field: 'severityText' },
              },
              services: {
                terms: { field: 'service.name' },
              },
              hourly_stats: {
                date_histogram: {
                  field: 'timestamp',
                  calendar_interval: 'hour',
                },
              },
            },
            size: 0,
          },
        });

        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message,
        });
        this.logger.error('Failed to get log stats', error.stack);
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Obtém o nome do índice baseado no tipo de log
   */
  private getIndexName(logData: LogContract): string {
    return `logs-${logData.type}`;
  }

  private getServiceInfo() {
    // TODO: need get service from user services registered in user db
    return {
      name: 'obersavability-service',
      version: '1.0.0',
    };
  }
}
