import { LogInputDto } from '@/modules/logs/application/dtos';
import { LogLevel } from '@/types/logs';
import { v4 as uuidv4 } from 'uuid';
import { Request, Response } from 'express';
import {
  Breadcrumb,
  DeviceContext,
  ErrorInfo,
  FormattedError,
  HttpContext,
  ILog,
  RequestInfo,
  ResponseInfo,
  SdkInfo,
  StackFrame,
  TraceInfo,
  UserInfo,
} from './log.interface';

export class LogEntity implements ILog {
  id: string;
  timestamp: string;
  level?: LogLevel;
  message?: string;
  platform?: string;
  app?: string;
  environment?: string;
  release?: string;
  fingerprint?: string;
  user?: UserInfo;
  error?: ErrorInfo;
  stackFrames?: StackFrame[];
  breadcrumbs?: Breadcrumb[];
  device?: DeviceContext;
  http?: HttpContext;
  sdk?: SdkInfo;
  trace?: TraceInfo;
  request?: RequestInfo;
  response?: ResponseInfo;
  tags?: string[];
  metadata?: Record<string, unknown>;

  constructor() {
    this.id = uuidv4();
    this.timestamp = new Date().toISOString();
  }

  getData(): ILog {
    return {
      id: this.id,
      timestamp: this.timestamp,
      level: this.level,
      message: this.message,
      platform: this.platform,
      app: this.app,
      environment: this.environment,
      release: this.release,
      fingerprint: this.fingerprint,
      user: this.user,
      error: this.error,
      stackFrames: this.stackFrames,
      breadcrumbs: this.breadcrumbs,
      device: this.device,
      http: this.http,
      sdk: this.sdk,
      trace: this.trace,
      request: this.request,
      response: this.response,
      tags: this.tags,
      metadata: this.metadata,
    };
  }

  enrichWithBody(body: LogInputDto): void {
    this.message = body.message || '';
    this.level = body.level;
    this.platform = body.platform;
    this.app = body.app;
    this.environment = body.environment;
    this.release = body.release;
    this.fingerprint = body.fingerprint;

    if (body.tags?.length) {
      this.tags = body.tags;
    }

    if (body.metadata) {
      this.metadata = body.metadata;
    }

    if (body.user) {
      this.user = {
        id: body.user.id,
        ip: body.user.ip,
        device: body.user.device,
        email: body.user.email,
        sessionId: body.user.sessionId,
      };
    }

    if (body.level === LogLevel.ERROR || body.level === LogLevel.FATAL) {
      this.error = this.sanitizeError(body.error);
    }

    if (body.stackFrames?.length) {
      this.stackFrames = body.stackFrames;
    }

    if (body.breadcrumbs?.length) {
      this.breadcrumbs = body.breadcrumbs;
    }

    if (body.device) {
      this.device = { ...body.device };
    }

    if (body.http) {
      this.http = { ...body.http };
    }

    if (body.sdk) {
      this.sdk = { ...body.sdk };
    }
  }

  enrichWithRequest(request: Request): void {
    this.request = {
      id: (request.headers['x-request-id'] as string) || uuidv4(),
      url: request.url,
      method: request.method,
      userAgent: request.get('user-agent') || '',
      ip: request.ip || '',
      correlationId: request.headers['x-correlation-id'] as string,
    };
  }

  enrichWithResponse(response?: Response): void {
    this.response = {
      statusCode: response?.statusCode,
      responseTimeMs: response?.get('X-Response-Time')
        ? Number(response?.get('X-Response-Time'))
        : undefined,
    };
  }

  sanitizeError(error: unknown): FormattedError | undefined {
    if (!error || typeof error !== 'object') {
      return undefined;
    }

    const err = error as Error & { cause?: Error; componentStack?: string };

    const stackLines = (err.stack || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    return {
      id: crypto.randomUUID(),
      name: err.name || 'Error',
      message: err.message || 'No message provided',
      stack: stackLines,
      cause: err.cause ? this.sanitizeError(err.cause) : undefined,
      componentStack: err.componentStack,
    };
  }

  static serialize(event: LogEntity): string {
    return JSON.stringify(event, (key, value) =>
      value instanceof Date ? value.toISOString() : value,
    );
  }
}
