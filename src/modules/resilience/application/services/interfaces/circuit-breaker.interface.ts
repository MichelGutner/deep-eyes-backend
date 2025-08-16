export type CircuitBreakerInterface = {
  execute: <T>(fn: () => Promise<T>) => Promise<T>;
};
