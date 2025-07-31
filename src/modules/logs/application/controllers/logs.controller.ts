/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  Req,
  Inject,
} from '@nestjs/common';
import { Request } from 'express';
import { LogsService } from '../services/logs.service';
import { SeverityNumber } from '@opentelemetry/api-logs';
import {
  Ctx,
  EventPattern,
  KafkaContext,
  Payload,
} from '@nestjs/microservices';
import { LogApplicationInputDto } from '../dtos';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { LogContract } from '../../domain';

@Controller('logs')
export class LogsController {
  constructor(
    @Inject('LogsService')
    private readonly logsService: LogsService,
    private readonly elasticsearchService: ElasticsearchService,
  ) {}

  @EventPattern(process.env.KAFKA_LOGS_TOPIC || 'logs')
  async handleKafkaLogEvent(
    @Payload() data: LogContract,
    @Ctx() context: KafkaContext,
  ): Promise<void> {
    try {
      const topic = context.getTopic();
      const message = context.getMessage();
      const key = message.key?.toString();
      const body = message.value;

      const existsInElasticsearch = await this.elasticsearchService.exists({
        index: `${topic}-${key}`,
        id: `${data.context?.requestId}-${data.trace?.traceId}`,
      });

      if (!existsInElasticsearch && body) {
        try {
          await this.elasticsearchService.create({
            index: `${topic}-${key}`,
            id: `${data.context?.requestId}-${data.trace?.traceId}`,
            body,
          });
        } catch (error) {
          console.error('❌ Failed to create log in Elasticsearch:', error);
          return;
        }
      } else {
        await this.elasticsearchService.index({
          index: `${topic}-${key}`,
          id: `${data.context?.requestId}-${data.trace?.traceId}`,
          body,
        });
      }
    } catch (error) {
      console.error('❌ Failed to index log to Elasticsearch:', error);
    }
  }

  @Post('application')
  async createApplicationLog(
    @Req() request: Request,
    @Body()
    body: LogApplicationInputDto,
  ) {
    try {
      await this.logsService.logApplication(body, request);
      return { status: 'success', message: 'Application log created' };
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }

  // @Post('error')
  // async createErrorLog(
  //   @Body()
  //   body: {
  //     error: {
  //       name: string;
  //       message: string;
  //       stack?: string;
  //     };
  //     context: {
  //       requestId: string;
  //       userId?: string;
  //       sessionId?: string;
  //       correlationId?: string;
  //       url?: string;
  //       method?: string;
  //       userAgent?: string;
  //       ip?: string;
  //     };
  //     attributes?: Record<string, any>;
  //   },
  // ) {
  //   const error = new Error(body.error.message);
  //   error.name = body.error.name;
  //   error.stack = body.error.stack;

  //   await this.logsService.logError(error, body.context, body.attributes || {});
  //   return { status: 'success', message: 'Error log created' };
  // }

  // @Post('performance')
  // async createPerformanceLog(
  //   @Body()
  //   body: {
  //     operation: string;
  //     component: string;
  //     duration: number;
  //     attributes?: Record<string, any>;
  //   },
  // ) {
  //   await this.logsService.logPerformance(
  //     body.operation,
  //     body.component,
  //     body.duration,
  //     body.attributes || {},
  //   );
  //   return { status: 'success', message: 'Performance log created' };
  // }

  // @Post('audit')
  // async createAuditLog(
  //   @Body()
  //   body: {
  //     action: string;
  //     resource: {
  //       type: string;
  //       id: string;
  //       name?: string;
  //     };
  //     user: {
  //       id: string;
  //       name?: string;
  //       email?: string;
  //       roles?: string[];
  //     };
  //     attributes?: Record<string, any>;
  //   },
  // ) {
  //   await this.logsService.logAudit(
  //     body.action,
  //     body.resource,
  //     body.user,
  //     body.attributes || {},
  //   );
  //   return { status: 'success', message: 'Audit log created' };
  // }

  // @Post('security')
  // async createSecurityLog(
  //   @Body()
  //   body: {
  //     event:
  //       | 'login'
  //       | 'logout'
  //       | 'access_denied'
  //       | 'permission_change'
  //       | 'data_access';
  //     user: {
  //       id: string;
  //       name?: string;
  //       email?: string;
  //     };
  //     ip: string;
  //     success: boolean;
  //     attributes?: Record<string, any>;
  //   },
  // ) {
  //   await this.logsService.logSecurity(
  //     body.event,
  //     body.user,
  //     body.ip,
  //     body.success,
  //     body.attributes || {},
  //   );
  //   return { status: 'success', message: 'Security log created' };
  // }

  // @Post('integration')
  // async createIntegrationLog(
  //   @Body()
  //   body: {
  //     provider: string;
  //     operation: string;
  //     duration: number;
  //     success: boolean;
  //     attributes?: Record<string, any>;
  //   },
  // ) {
  //   await this.logsService.logIntegration(
  //     body.provider,
  //     body.operation,
  //     body.duration,
  //     body.success,
  //     body.attributes || {},
  //   );
  //   return { status: 'success', message: 'Integration log created' };
  // }

  @Get('search')
  async searchLogs(
    @Query('service_name') serviceName: string,
    @Query('query') query?: string,
    @Query('type') type?: string,
    @Query('size') size?: number,
    @Query('start_time') startTime?: string,
    @Query('end_time') endTime?: string,
    // sererity must be one of: TRACE, DEBUG, INFO, WARN, ERROR, FATAL
    @Query('severity') severity?: string,
  ) {
    let searchQuery: any = {};

    if (query) {
      searchQuery = {
        multi_match: {
          query,
          fields: ['message', 'attributes.*'],
        },
      };
    }

    // if (startTime && endTime) {
    //   return this.logsService.searchLogsByTimeRange(
    //     startTime,
    //     endTime,
    //     type as any,
    //     size || 100,
    //   );
    // }

    // if (severity) {
    //   const severityNumber = this.getSeverityNumber(severity);
    //   return this.logsService.searchLogsBySeverity(
    //     severityNumber,
    //     type as any,
    //     size || 100,
    //   );
    // }

    // if (type) {
    //   return this.logsService.searchLogsByType(
    //     type as any,
    //     searchQuery,
    //     size || 100,
    //   );
    // }

    try {
      const searchData = await this.logsService.searchLogs(
        searchQuery,
        `${process.env.KAFKA_LOGS_TOPIC}-${serviceName}`,
        size || 100,
      );

      return {
        //@ts-ignore
        total: searchData.hits.total.value,
        data: searchData.hits.hits.map((hit) => hit._source),
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Failed to retrieve logs: ${error.message}`,
      };
    }
  }

  @Get('error')
  async searchErrorLogs(
    @Query('query') query?: string,
    @Query('size') size?: number,
  ) {
    const searchQuery = query
      ? {
          multi_match: {
            query,
            fields: ['message', 'error.message', 'error.stack'],
          },
        }
      : {};

    return this.logsService.searchErrorLogs(searchQuery, size || 100);
  }

  @Get('performance')
  async searchPerformanceLogs(
    @Query('query') query?: string,
    @Query('size') size?: number,
  ) {
    const searchQuery = query
      ? {
          multi_match: {
            query,
            fields: ['message', 'operation', 'component'],
          },
        }
      : {};

    return this.logsService.searchPerformanceLogs(searchQuery, size || 100);
  }

  // @Get('audit')
  // async searchAuditLogs(
  //   @Query('query') query?: string,
  //   @Query('size') size?: number,
  // ) {
  //   const searchQuery = query
  //     ? {
  //         multi_match: {
  //           query,
  //           fields: [
  //             'message',
  //             'action',
  //             'resource.type',
  //             'resource.id',
  //             'user.id',
  //           ],
  //         },
  //       }
  //     : {};

  //   return this.logsService.searchAuditLogs(searchQuery, size || 100);
  // }

  // @Get('security')
  // async searchSecurityLogs(
  //   @Query('query') query?: string,
  //   @Query('size') size?: number,
  // ) {
  //   const searchQuery = query
  //     ? {
  //         multi_match: {
  //           query,
  //           fields: ['message', 'event', 'user.id', 'ip'],
  //         },
  //       }
  //     : {};

  //   return this.logsService.searchSecurityLogs(searchQuery, size || 100);
  // }

  @Get('trace/:traceId')
  async searchLogsByTraceId(@Param('traceId') traceId: string) {
    return this.logsService.searchLogsByTraceId(traceId);
  }

  @Get('request/:requestId')
  async searchLogsByRequestId(@Param('requestId') requestId: string) {
    return this.logsService.searchLogsByRequestId(requestId);
  }

  @Get('stats')
  async getLogStats(
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
  ) {
    const timeRange =
      startTime && endTime ? { start: startTime, end: endTime } : undefined;
    return this.logsService.getLogStats(timeRange);
  }

  @Get('health')
  async healthCheck() {
    try {
      // Testa a conexão com Elasticsearch
      await this.logsService.searchLogs({ match_all: {} }, undefined, 1);
      return {
        status: 'healthy',
        message: 'Logs service is working correctly',
      };
    } catch (error) {
      return { status: 'unhealthy', message: error.message };
    }
  }

  private getSeverityNumber(severity: string): SeverityNumber {
    switch (severity.toUpperCase()) {
      case 'TRACE':
        return SeverityNumber.TRACE;
      case 'DEBUG':
        return SeverityNumber.DEBUG;
      case 'INFO':
        return SeverityNumber.INFO;
      case 'WARN':
        return SeverityNumber.WARN;
      case 'ERROR':
        return SeverityNumber.ERROR;
      case 'FATAL':
        return SeverityNumber.FATAL;
      default:
        return SeverityNumber.INFO;
    }
  }
}
