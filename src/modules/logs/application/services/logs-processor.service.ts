import { Injectable } from '@nestjs/common';
import { LogProcessorInterface } from './interfaces/log-processor.interface';
import { BatchProcessor, BatchConfig } from './batch-processor.service';
import { CircularBuffer } from './circular-buffer.service';
import { Inject } from '@nestjs/common';
import { ResilienceInterface } from '@/modules/resilience';
import { TelemetryManager } from '@/modules/shared/telemetry/manager';
import { LogEntity } from '../../domain';

@Injectable()
export class LogsProcessorService implements LogProcessorInterface {
  private logBuffer = new CircularBuffer<LogEntity>(1000);
  private batchProcessor: BatchProcessor<LogEntity>;

  constructor(
    @Inject(TelemetryManager)
    private readonly telemetryManager: TelemetryManager,
    @Inject('ResilienceService')
    private readonly resilienceService: ResilienceInterface,
  ) {
    this.batchProcessor = new BatchProcessor<LogEntity>(
      this.logBuffer,
      new BatchConfig(10000, 100, 5),
      async (batches) => {
        this.resilienceService.sendWithResilience(
          async () => {
            for (const batch of batches) {
              this.telemetryManager.emitBatch(batch);
            }
          },
          {
            delay: 8000,
            maxDelay: 10000,
            backoffFactor: 'exponential',
            maxRetries: 8,
          },
        );
      },
    );
  }

  enqueueLog(log: LogEntity) {
    this.logBuffer.push(log);
  }
}
