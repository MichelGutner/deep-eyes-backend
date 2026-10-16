/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Inject, Injectable } from '@nestjs/common';
import { LogInputDto } from '../dtos';
import { BatchIngestResult } from '../dtos/batch-log.dto';
import { TracingServiceInterface } from '@/modules/tracing';
import { Request } from 'express';
import { LogsProcessorService } from './logs-processor.service';
import { LogEntity } from '../../domain';
import { ESServiceInterface, LogQueryFilters } from '@/modules/elasticsearch';

@Injectable()
export class LogsService {
  constructor(
    @Inject('TracingService')
    private readonly tracingService: TracingServiceInterface,
    @Inject('ESService')
    private readonly esService: ESServiceInterface,
    private readonly logsProcessorService: LogsProcessorService,
  ) {}

  async enqueueLog(logInputData: LogInputDto, req: Request): Promise<LogEntity> {
    const logEntity = new LogEntity();
    logEntity.enrichWithBody(logInputData);
    logEntity.enrichWithRequest(req);
    logEntity.enrichWithResponse(req?.res);
    const logData = logEntity.getData();

    const enrichedLog = await this.tracingService.addTraceInfoToLog(logData);
    this.logsProcessorService.enqueueLog(enrichedLog);

    return enrichedLog;
  }

  async batchIngest(
    batch: LogInputDto[],
    req: Request,
  ): Promise<BatchIngestResult> {
    let accepted = 0;
    const errors: string[] = [];

    for (let i = 0; i < batch.length; i++) {
      try {
        const logEntity = new LogEntity();
        logEntity.enrichWithBody(batch[i]);
        logEntity.enrichWithRequest(req);
        const logData = logEntity.getData();
        const enrichedLog = await this.tracingService.addTraceInfoToLog(logData);
        this.logsProcessorService.enqueueLog(enrichedLog);
        accepted++;
      } catch (err) {
        errors.push(`Log index ${i}: ${err.message}`);
      }
    }

    return { accepted, rejected: errors.length, errors: errors.length ? errors : undefined };
  }

  async getLogs(filters: LogQueryFilters) {
    try {
      const result = await this.esService.queryLogs(filters);
      return {
        total: (result.hits.total as any)?.value ?? result.hits.hits.length,
        logs: result.hits.hits.map((hit) => ({ _id: hit._id, ...(hit._source as object) })),
      };
    } catch {
      return { total: 0, logs: [] };
    }
  }

  async getLogById(id: string) {
    try {
      const result = await this.esService.getDocument('logs-*', id);
      if (!result) return null;
      return { _id: result._id, ...(result._source as object) };
    } catch {
      return null;
    }
  }

  async getLogMetrics(timeRange?: string) {
    return this.esService.aggregateLogsByLevel('logs-*', timeRange);
  }

  async searchLogs({ streamName }: { streamName: string }) {
    try {
      const documents = await this.esService.getStreamDocuments(streamName);
      return {
        total: documents.hits.total,
        logs: documents.hits.hits.map((hit) => hit._source),
      };
    } catch {
      return { total: 0, logs: [] };
    }
  }
}
