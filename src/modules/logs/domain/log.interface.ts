import { LogLevel, LogType } from "@/types/logs";

export interface FormattedError {
  id: string;
  name: string;
  message: string;
  stack: string[];
  cause?: FormattedError;
  componentStack?: string;
}

export interface StackFrame {
  filename: string;
  function: string;
  lineno?: number;
  colno?: number;
  in_app: boolean;
  module?: string;
  context_line?: string;
  pre_context?: string[];
  post_context?: string[];
}

export interface Breadcrumb {
  timestamp: string;
  type: string;
  category: string;
  message: string;
  level?: string;
  data?: Record<string, string | number | boolean>;
}

export interface DeviceContext {
  os?: string;
  osVersion?: string;
  browser?: string;
  browserVersion?: string;
  model?: string;
  manufacturer?: string;
  appVersion?: string;
  screenResolution?: string;
  screenDensity?: number;
  locale?: string;
  timezone?: string;
  online?: boolean;
  memoryMb?: number;
  simulator?: boolean;
  orientation?: string;
  battery?: number;
  arch?: string;
  brand?: string;
  freeMemoryMb?: number;
  totalStorageMb?: number;
  freeStorageMb?: number;
  batteryState?: string;
  networkType?: string;
  carrier?: string;
  ipAddress?: string;
  rooted?: boolean;
  deviceId?: string;
}

export interface HttpContext {
  method?: string;
  url?: string;
  statusCode?: number;
  responseTime?: number;
  headers?: Record<string, string>;
  queryString?: string;
  bodySize?: number;
}

export interface SdkInfo {
  name: string;
  version: string;
  integrations?: string[];
}

export interface ILog {
  id: string;
  timestamp?: string;
  level?: LogLevel;
  message?: string;
  platform?: string;
  app?: string;
  environment?: string;
  release?: string;
  fingerprint?: string;
  user?: UserInfo;
  tags?: string[];
  metadata?: Record<string, unknown>;
  statusCode?: number;
  type?: LogType;
  entity?: Entity;
  error?: ErrorInfo;
  stackFrames?: StackFrame[];
  breadcrumbs?: Breadcrumb[];
  device?: DeviceContext;
  http?: HttpContext;
  sdk?: SdkInfo;
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
  ip?: string;
  device?: string;
  email?: string;
  sessionId?: string;
}

export interface ErrorInfo {
  id: string;
  name?: string;
  message?: string;
  stack?: string | string[];
  cause?: unknown;
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
  userAgent?: string;
  ip?: string;
  correlationId?: string;
  samplingPolicies?: Record<LogLevel, number>;
}

export interface ResponseInfo {
  statusCode?: number;
  responseTimeMs?: number;
}
