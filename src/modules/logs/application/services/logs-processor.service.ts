import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { LogProcessorInterface } from './interfaces/log-processor.interface';
import { BatchProcessor, BatchConfig } from './batch-processor.service';
import { CircularBuffer } from './circular-buffer.service';
import { ResilienceInterface } from '@/modules/resilience';
import { TelemetryManager } from '@/modules/shared/telemetry/manager';
import { LogEntity } from '../../domain';
import { Logger } from '@/logger/application';

interface RetryConfig {
  delay: number;
  maxDelay: number;
  backoffFactor: 'exponential' | 'linear';
  maxRetries: number;
}

@Injectable()
export class LogsProcessorService implements LogProcessorInterface {
  private logBuffer: CircularBuffer<LogEntity>;
  private batchProcessor: BatchProcessor<LogEntity>;

  constructor(
    @Inject(TelemetryManager)
    private readonly telemetryManager: TelemetryManager,
    @Inject('ResilienceService')
    private readonly resilienceService: ResilienceInterface,
    @Inject('Logger')
    private readonly logger: Logger,
  ) {
    this.logBuffer = new CircularBuffer<LogEntity>(1000);
    this.batchProcessor = new BatchProcessor<LogEntity>(
      this.logBuffer,
      new BatchConfig(10000, 100, 5),
      async (batches: LogEntity[][]) => {
        try {
          this.logger.debug(`Processing batch of ${batches.length} logs`);
          const retryConfig: RetryConfig = {
            delay: 8000,
            maxDelay: 10000,
            backoffFactor: 'exponential',
            maxRetries: 8,
          };
          await this.resilienceService.sendWithResilience(async () => {
            for (const batch of batches) {
              await this.telemetryManager.emitBatch(batch);
            }
          }, retryConfig);
          this.logger.debug(
            `Successfully processed batch of ${batches.length} logs`,
          );
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          const errorStack = error instanceof Error ? error.stack : undefined;
          this.logger.error(
            `Failed to process log batch: ${errorMessage}`,
            errorStack,
          );
          throw error;
        }
      },
    );
  }

  public enqueueLog(log: LogEntity): void {
    try {
      if (!this.logBuffer) {
        this.logger.error('Log buffer not initialized');
        return;
      }

      this.logBuffer.push(log);
      this.logger.debug(`Enqueued log with ID: ${log.id}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to enqueue log: ${errorMessage}`, errorStack);
      throw error;
    }
  }
}
