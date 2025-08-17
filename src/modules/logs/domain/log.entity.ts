import { LogInputDto } from '@/modules/logs/application/dtos';
import { LogLevel, LogType } from '@/types/logs';
import { v4 as uuidv4 } from 'uuid';
import { Request, Response } from 'express';
import { IncomingHttpHeaders } from 'http';
import {
  Entity,
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
      tags: this.tags,
      statusCode: this.statusCode,
      type: this.type,
      entity: this.entity,
      error: this.error,
      trace: this.trace,
      request: this.request,
      response: this.response,
      attributes: this.attributes,
      source: this.source,
      version: this.version,
      priority: this.priority,
      method: this.method,
      durationMs: this.durationMs,
    };
  }

  enrichWithBody(body: LogInputDto): void {
    this.message = body.message;
    this.level = body.level;
    this.message = body.message || '';
    this.user = body.user;
    this.tags = body.tags || [];
    this.statusCode = body.statusCode;
    this.error =
      body.level === LogLevel.ERROR
        ? this.sanatizeError(body.error)
        : undefined;
  }

  enrichWithRequest(request: Request) {
    this.request = {
      id: request.id?.toString() || uuidv4(),
      url: request.url,
      method: request.method,
      headers: request.headers as Record<string, string>,
      userAgent: request.get('user-agent') || '',
      size: Number(request.headers['content-length'] || 0),
      queryParams: request.query as Record<string, string>,
      bodySize: request.body ? JSON.stringify(request.body).length : 0,
      ip: request.ip || '',
      correlationId: request.headers['x-correlation-id'] as string,
      samplingPolicies: this.parseSamplingHeaderToPolice(request.headers),
    };
  }

  enriqhWithResponse(response?: Response): void {
    this.response = {
      statusCode: response?.statusCode,
      cached: response?.get('X-Cache') === 'HIT',
      bodySize: response?.get('Content-Length')
        ? Number(response?.get('Content-Length'))
        : 0,
      responseTimeMs: response?.get('X-Response-Time')
        ? Number(response?.get('X-Response-Time'))
        : 0,
    };
  }

  private parseSamplingHeaderToPolice(
    headers: IncomingHttpHeaders,
  ): Record<string, number> {
    let header = headers?.['x-sampling-levels'];
    if (Array.isArray(header)) {
      header = header.join(',');
    }
    if (typeof header !== 'string') {
      header = undefined;
    }

    const levels: Record<string, number> = {};

    const parts = header?.split(',');
    for (const part of parts || []) {
      const [level, rate] = part.split('=');

      if (level && rate) {
        levels[level.trim()] = parseFloat(rate);
      }
    }

    return Object.keys(levels).length > 0 ? levels : defaultPolicies;
  }

  sanatizeError(
    error: unknown,
    options?: { clean?: boolean },
  ): FormattedError | undefined {
    if (!error || typeof error !== 'object') {
      return undefined;
    }

    const err = error as Error & { cause?: Error };

    const stackLines = (err.stack || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const cleanedStack = options?.clean
      ? stackLines.filter(
          (line) =>
            !line.includes('node_modules') && !line.includes('(internal'),
        )
      : stackLines;

    return {
      id: crypto.randomUUID(),
      name: err.name || 'Error',
      message: err.message || 'No message provided',
      stack: cleanedStack,
      cause: err.cause ? this.sanatizeError(err.cause, options) : undefined,
    };
  }

  static serialize(event: LogEntity): string {
    return JSON.stringify(event, (key, value) => {
      if (value instanceof Date) {
        return value.toISOString();
      }
      return value;
    });
  }
}
export const defaultPolicies: Record<string, number> = {
  debug: 0.1,
  info: 0.3,
  warn: 0.7,
  error: 1.0,
  fatal: 1.0,
};
