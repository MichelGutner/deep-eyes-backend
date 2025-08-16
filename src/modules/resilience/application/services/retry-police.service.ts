import { Injectable } from '@nestjs/common';
import {
  RetryConfig,
  RetryPoliceInterface,
} from './interfaces/retry-police.interface';
import { sleep } from '@/modules/shared';

@Injectable()
export class RetryPolice implements RetryPoliceInterface {
  async execute<T>(fn: () => Promise<T>, config: RetryConfig) {
    let lastError: Error | undefined = undefined;
    let attempt = 0;

    while (attempt < config.maxRetries) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        attempt++;

        if (attempt >= config.maxRetries) {
          break;
        }

        const isExponential = config.backoffFactor === 'exponential';
        const backoff = isExponential ? Math.pow(2, attempt - 1) : attempt;
        
        const delay = Math.min(config.delay * backoff, config.maxDelay);

        await sleep(delay);
      }
    }

    throw new MaxRetriesExceededError(
      `Operation failed after ${attempt} attempts`,
      lastError ?? new Error('Unknown error'),
    );
  }
}

export class MaxRetriesExceededError extends Error {
  constructor(
    message: string,
    public readonly cause: Error,
  ) {
    super(message);
    this.name = 'MaxRetriesExceededError';
    this.cause = cause;
  }
}
