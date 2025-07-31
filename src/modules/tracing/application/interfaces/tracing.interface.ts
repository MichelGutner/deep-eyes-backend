import { LogContract } from '@/modules/logs/domain';
import { Request } from 'express';

export type TracingServiceInterface = {
  createBusinessSpan: <T>(
    operationName: string,
    operation: () => Promise<T>,
    attributes?: Record<string, any>,
  ) => Promise<T>;
  createDatabaseSpan: <T>(
    query: string,
    operation: () => Promise<T>,
    params?: any[],
  ) => Promise<T>;
  createCacheSpan: <T>(
    operation: 'get' | 'set' | 'delete',
    key: string,
    operationFn: () => Promise<T>,
  ) => Promise<T>;
  addAttributes: (attributes: Record<string, any>) => void;
  addEvent: (eventName: string, attributes?: Record<string, any>) => void;
  getCurrentTraceId: () => string | undefined;
  createValidationSpan: <T>(
    operationName: string,
    operation: () => Promise<T>,
    attributes?: Record<string, any>,
  ) => Promise<T>;
  traceHttpRequestLog: (
    request: Request,
    log: LogContract,
  ) => Promise<LogContract | undefined>;
};
