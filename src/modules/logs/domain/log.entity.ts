import { LogInputDto } from '@/modules/logs/application/dtos';
import { LogLevel } from '@/types/logs';
import { v4 as uuidv4 } from 'uuid';
import { Request, Response } from 'express';
import {
  ErrorInfo,
  FormattedError,
  ILog,
  RequestInfo,
  ResponseInfo,
  TraceInfo,
  UserInfo,
} from './log.interface';

export class LogEntity implements ILog {
  id: string;
  timestamp: string;
  level?: LogLevel;
  message?: string;
  user?: UserInfo;
  error?: ErrorInfo;
  trace?: TraceInfo;
  request?: RequestInfo;
  response?: ResponseInfo;

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
      user: this.user,
      error: this.error,
      trace: this.trace,
      request: this.request,
      response: this.response,
    };
  }

  enrichWithBody(body: LogInputDto): void {
    this.message = body.message || '';
    this.level = body.level;
    this.user = body.user
      ? { id: body.user.id, ip: body.user.ip, device: body.user.device }
      : undefined;

    if (body.level === LogLevel.ERROR) {
      this.error = this.sanitizeError(body.error);
    }
  }

  enrichWithRequest(request: Request): void {
    this.request = {
      id:
        (request.headers['x-request-id'] as string) ||
        uuidv4(),
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

    const err = error as Error & { cause?: Error };

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
    };
  }

  static serialize(event: LogEntity): string {
    return JSON.stringify(event, (key, value) =>
      value instanceof Date ? value.toISOString() : value,
    );
  }
}
