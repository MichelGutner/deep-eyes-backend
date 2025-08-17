import { LogLevel, LogType } from "@/types/logs";

export interface FormattedError {
  id: string;
  name: string;
  message: string;
  stack: string[];
  cause?: FormattedError;
}

export interface ILog {
  id: string;
  timestamp?: string;
  level?: LogLevel;
  message?: string;
  user?: UserInfo;
  tags?: string[];
  statusCode?: number;
  type?: LogType;
  entity?: Entity;
  error?: ErrorInfo;
  trace?: TraceInfo;
  request?: RequestInfo;
  response?: ResponseInfo;
  attributes?: Record<string, unknown>;
  source?: string;
  version?: string;
  priority?: number;
  method?: string;
  durationMs?: number;
}

export interface Entity {
  id: string;
  name: string;
  type: 'mobile' | 'web' | 'service';
  version?: string;
  environment?: string;
  component?: string;
}

export interface UserInfo {
  id: string;
  name?: string;
  ip?: string;
  device?: string;
}

export interface ErrorInfo {
  id: string;
  name?: string;
  message?: string;
  stack?: string | string[];
  cause?: unknown;
  fingerprint?: string;
  className?: string;
  statusCode?: number;
  statusText?: string;
}

export interface TraceInfo {
  traceId: string;
  traceFlags?: number;
  spanId?: string;
  parentSpanId?: string;
  baggage?: Record<string, unknown>;
}

export interface RequestInfo {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  userAgent?: string;
  size?: number;
  queryParams?: Record<string, string>;
  bodySize?: number;
  ip?: string;
  correlationId?: string;
  samplingPolicies?: Record<LogLevel, number>;
}
export interface ResponseInfo {
  statusCode?: number;
  headers?: Record<string, string>;
  bodySize?: number;
  cached?: boolean;
  responseTimeMs?: number;
}
