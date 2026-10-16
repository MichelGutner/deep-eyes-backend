import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  Req,
  Inject,
  ServiceUnavailableException,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@/modules/auth/application/decorators/public.decorator';
import { LogsService } from '../services/logs.service';
import { LogInputDto, BatchLogDto } from '../dtos';
import { MaxRetriesExceededError } from '@/modules/resilience/application/services/retry-police.service';
import { Logger } from '@/logger/application';
import { PrismaService, PRISMA_SERVICE } from '@/modules/prisma';

@Controller('logs')
export class LogsController {
  constructor(
    @Inject('LogsService')
    private readonly logsService: LogsService,
    @Inject('Logger')
    private readonly logger: Logger,
    @Inject(PRISMA_SERVICE)
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async getLogs(
    @Query('level') level?: string,
    @Query('platform') platform?: string,
    @Query('environment') environment?: string,
    @Query('app') app?: string,
    @Query('search') search?: string,
    @Query('timeRange') timeRange?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.logsService.getLogs({
      level,
      platform,
      environment,
      app,
      search,
      timeRange,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('metrics')
  async getMetrics(@Query('timeRange') timeRange?: string) {
    return this.logsService.getLogMetrics(timeRange);
  }

  @Get(':id')
  async getLogById(@Param('id') id: string) {
    return this.logsService.getLogById(id);
  }

  @Public()
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

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Post('batch')
  @HttpCode(HttpStatus.OK)
  async batchIngest(@Body() body: BatchLogDto, @Req() req: Request) {
    const app = await this.prisma.application.findUnique({
      where: { apiKey: body.apiKey } as any,
    });

    if (!app) {
      throw new UnauthorizedException('Invalid API Key');
    }

    try {
      const result = await this.logsService.batchIngest(body.batch, req, app.id);
      this.logger.debug(`Batch ingest: ${result.accepted} accepted, ${result.rejected} rejected`);
      return result;
    } catch (error) {
      this.logger.error(`Batch ingest failed: ${error.message}`, error.stack);
      throw new ServiceUnavailableException('Batch ingest failed. Please try again later.');
    }
  }

  @Public()
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
}
