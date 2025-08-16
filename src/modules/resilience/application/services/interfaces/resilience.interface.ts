import { RetryConfig } from './retry-police.interface';

export type ResilienceInterface = {
  sendWithResilience: <T>(
    fn: () => Promise<T>,
    config: RetryConfig,
  ) => Promise<T>;
};
