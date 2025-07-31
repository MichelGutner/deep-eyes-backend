import { LogApplicationInputDto } from '../../application/dtos';

export interface LogContract {
  timestamp: string;
  level: string;
  message: string;
  service: {
    name: string;
    version?: string;
  };
  type: 'application' | 'error' | 'performance';
  user?: {
    id?: string;
    name?: string;
    ip?: string;
    device?: string;
    geo?: {
      country?: string;
      city?: string;
      lat?: number;
      lon?: number;
    };
  };
  metadata?: Record<string, any>;
  statusCode?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  indentifier?: string;
  trace?: {
    traceId: string;
    spanId: string;
    traceFlags: number;
  };
  host?: {
    name: string;
    path: string;
    ip: string;
    pid?: number;
  };
  method?: string;
  context?: {
    requestId: string;
    correlationId: string;
    url: string;
    userAgent: string;
  };
  responseTime?: number;
  severityText?: string;
}

export interface ApplicationLogContract extends LogContract {
  level: string;
  message: string;
  service: {
    name: string;
    version?: string;
  };
}

export interface ErrorLogContract extends LogContract {
  error: {
    name: string;
    message: string;
    stack?: string;
  };
}

export class LogContractFactory {
  static createApplicationLog(props: LogApplicationInputDto): LogContract {
    return {
      ...this.getBaseLog(props),
      message: props.message,
      type: 'application',
      metadata: props.metadata,
      statusCode: props.statusCode,
      user: props.user,
    } as LogContract;
  }

  static createErrorLog(
    props: LogApplicationInputDto,
    error: Error,
    context: ErrorLogContract['context'],
    metadata: Record<string, any> = {},
  ): LogContract {
    return {
      ...this.getBaseLog(props),
      level: 'error',
      message: error.message,
      type: 'error',
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      context,
      metadata,
    } as LogContract;
  }

  private static getBaseLog(
    props: LogApplicationInputDto,
  ): Partial<LogContract> {
    return {
      level: props.level,
      message: props.message,
      type: 'application',
      metadata: props.metadata,
      statusCode: props.statusCode,
      user: props.user,
      timestamp: new Date().toISOString(),
    };
  }
}
