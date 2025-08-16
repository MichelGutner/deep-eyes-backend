import { CircuitBreakerInterface } from './interfaces/circuit-breaker.interface';

export class CircuitBreaker implements CircuitBreakerInterface {
  private state: 'closed' | 'open' | 'half_open' = 'closed';
  private failureCount = 0;
  private lastFailure: number | null = null;

  constructor(private readonly config: CircuitBreakerConfig) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.shouldTryReset()) {
        this.state = 'half_open';
      } else {
        throw new CircuitBreakerOpenError();
      }
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordSuccess(): void {
    this.failureCount = 0;
    if (this.state === 'half_open') {
      this.state = 'closed';
    }
  }

  private recordFailure(): void {
    this.failureCount++;
    this.lastFailure = Date.now();

    if (this.failureCount >= this.config.threshold) {
      this.state = 'open';
    }
  }

  private shouldTryReset(): boolean {
    if (this.state === 'closed') return false;
    const now = Date.now();
    return (
      this.lastFailure !== null && now - this.lastFailure > this.config.timeout
    );
  }
}

export class CircuitBreakerOpenError extends Error {
  constructor() {
    super('Circuit breaker is open, operation cannot be performed');
    this.name = 'CircuitBreakerOpenError';
  }
}

export interface CircuitBreakerConfig {
  threshold: number;
  timeout: number;
  halfOpenAttempts: number;
}
