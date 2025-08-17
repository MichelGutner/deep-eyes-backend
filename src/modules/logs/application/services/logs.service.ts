/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { LogInputDto } from '../dtos';
import { TracingServiceInterface } from '@/modules/tracing';
import { Request } from 'express';
import { LogsProcessorService } from './logs-processor.service';
import { LogEntity } from '../../domain';

@Injectable()
export class LogsService {
  private readonly logger = new Logger(LogsService.name);
  private readonly tracer = trace.getTracer('deep-eyes-backend');

  constructor(
    @Inject('TracingService')
    private readonly tracingService: TracingServiceInterface,
    private readonly elasticsearchService: ElasticsearchService,
    private readonly logsProcessorService: LogsProcessorService,
  ) {}

  /**
   * Cria e salva log de aplicação
   */
  async enqueueLog(
    logInputData: LogInputDto,
    req: Request,
  ): Promise<LogEntity> {
    const logEntity = new LogEntity();
    logEntity.enrichWithBody(logInputData);
    logEntity.enrichWithRequest(req);
    logEntity.enriqhWithResponse(req?.res);
    const logData = logEntity.getData();

    const enrichedLog = await this.tracingService.addTraceInfoToLog(logData);

    this.logsProcessorService.enqueueLog(enrichedLog);

    return enrichedLog;
  }
  /**
   * Busca logs no Elasticsearch
   */
  async searchLogs(query: any, index?: string, size: number = 100) {
    return this.tracer.startActiveSpan('logs.search', async (span) => {
      try {
        span.setAttribute('logs.search.size', size);
        span.setAttribute('logs.search.index', index || 'all');

        const result = await this.elasticsearchService.search<LogEntity>({
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
  // async searchLogsByType(
  //   type: unknown,
  //   query: any = {},
  //   size: number = 100,
  // ): Promise<any> {
  //   const typeQuery = {
  //     bool: {
  //       must: [{ term: { type } }, query],
  //     },
  //   };
  //   return this.searchLogs(typeQuery, `logs-${type}`, size);
  // }

  /**
   * Busca logs de erro
   */
  // async searchErrorLogs(query: any = {}, size: number = 100): Promise<any> {
  //   return this.searchLogsByType('error', query, size);
  // }

  /**
   * Busca logs de performance
   */
  // async searchPerformanceLogs(
  //   query: any = {},
  //   size: number = 100,
  // ): Promise<any> {
  //   return this.searchLogsByType('performance', query, size);
  // }

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
  // async searchLogsByTimeRange(
  //   startTime: string,
  //   endTime: string,
  //   type?: LogContract['type'],
  //   size: number = 100,
  // ): Promise<any> {
  //   const timeQuery = {
  //     range: {
  //       timestamp: {
  //         gte: startTime,
  //         lte: endTime,
  //       },
  //     },
  //   };

  //   if (type) {
  //     return this.searchLogsByType(type, timeQuery, size);
  //   }

  //   return this.searchLogs(timeQuery, undefined, size);
  // }

  /**
   * Busca logs por severity
   */
  // async searchLogsBySeverity(
  //   severity: SeverityNumber,
  //   type?: LogContract['type'],
  //   size: number = 100,
  // ): Promise<any> {
  //   const severityQuery = {
  //     term: { severity },
  //   };

  //   if (type) {
  //     return this.searchLogsByType(type, severityQuery, size);
  //   }

  //   return this.searchLogs(severityQuery, undefined, size);
  // }

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
}
