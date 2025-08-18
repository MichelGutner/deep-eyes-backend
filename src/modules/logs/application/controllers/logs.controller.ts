import {
  Controller,
  Post,
  Body,
  Req,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Request } from 'express';
import { LogsService } from '../services/logs.service';
import { LogInputDto } from '../dtos';
import { MaxRetriesExceededError } from '@/modules/resilience/application/services/retry-police.service';
import { Logger } from '@/logger/application';

@Controller('logs')
export class LogsController {
  constructor(
    @Inject('LogsService')
    private readonly logsService: LogsService,
    @Inject('Logger')
    private readonly logger: Logger,
  ) {}

  @Post('application')
  async enqueueLog(@Body() body: LogInputDto, @Req() req: Request) {
    try {
      const log = await this.logsService.enqueueLog(body, req);
      this.logger.debug(`Log enqueued: ${log.id}`);
      return { success: true, logId: log.id };
    } catch (error) {
      this.logger.error(`Failed to enqueue log: ${error.message}`, error.stack);

      if (error instanceof MaxRetriesExceededError) {
        throw new ServiceUnavailableException(
          'Logging service temporarily unavailable. Please try again later.',
        );
      }

      throw new ServiceUnavailableException(
        'Failed to process log. Please try again later.',
      );
    }
  }

  @Post('search')
  async searchLogs(@Body() body: { streamName: string }) {
    try {
      this.logger.debug(`Searching logs for stream: ${body.streamName}`);
      return await this.logsService.searchLogs(body);
    } catch (error) {
      this.logger.error(`Failed to search logs: ${error.message}`, error.stack);
      throw new ServiceUnavailableException(
        'Failed to search logs. Please try again later.',
      );
    }
  }

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
}
