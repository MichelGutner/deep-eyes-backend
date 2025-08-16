export interface RetryConfig {
  maxRetries: number;
  backoffFactor: 'exponential' | 'linear';
  delay: number;
  maxDelay: number;
}

export type RetryPoliceInterface = {
  execute: <T>(fn: () => Promise<T>, config: RetryConfig) => Promise<T>;
};
