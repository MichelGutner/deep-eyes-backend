import { Inject, Injectable } from '@nestjs/common';
import { CircuitBreaker } from './circuit-breaker.service';
import {
  RetryConfig,
  RetryPoliceInterface,
} from './interfaces/retry-police.interface';
import { ResilienceInterface } from './interfaces/resilience.interface';

@Injectable()
export class ResilienceService implements ResilienceInterface {
  constructor(
    @Inject('RetryPoliceService')
    private readonly retryPolice: RetryPoliceInterface,
  ) {}

  private circuitBreaker = new CircuitBreaker({
    threshold: 5,
    timeout: 10000,
    halfOpenAttempts: 3,
  });

  async sendWithResilience<T>(
    operation: () => Promise<T>,
    config: RetryConfig,
  ): Promise<T> {
    return await this.circuitBreaker.execute(async () => {
      return this.retryPolice.execute(operation, config);
    });
  }
}
