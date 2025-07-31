import { Injectable } from '@nestjs/common';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { TracingServiceInterface } from './interfaces/tracing.interface';
import { Request } from 'express';
import { LogContract } from '@/modules/logs/domain';
import { v4 as uuid } from 'uuid';

@Injectable()
export class TracingService implements TracingServiceInterface {
  private readonly tracer = trace.getTracer(
    process.env.KAFKA_CLIENT_ID || 'default-client-id',
  );

  /**
   * Cria um span customizado para operações de negócio
   */
  async createBusinessSpan<T>(
    operationName: string,
    operation: () => Promise<T>,
    attributes?: Record<string, any>,
  ): Promise<T> {
    return this.tracer.startActiveSpan(operationName, async (span) => {
      try {
        // Adiciona atributos customizados ao span
        if (attributes) {
          Object.entries(attributes).forEach(([key, value]) => {
            span.setAttribute(key, value);
          });
        }

        // Adiciona evento ao span
        span.addEvent('operation.started', {
          timestamp: new Date().toISOString(),
        });

        // Executa a operação
        const result = await operation();

        // Adiciona evento de sucesso
        span.addEvent('operation.completed', {
          timestamp: new Date().toISOString(),
        });

        // Marca o span como bem-sucedido
        span.setStatus({ code: SpanStatusCode.OK });

        return result;
      } catch (error) {
        // Adiciona evento de erro
        span.addEvent('operation.error', {
          'error.message': error.message,
          'error.stack': error.stack,
          timestamp: new Date().toISOString(),
        });

        // Marca o span como com erro
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message,
        });

        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Cria um span para operações de banco de dados
   */
  async createDatabaseSpan<T>(
    query: string,
    operation: () => Promise<T>,
    params?: any[],
  ): Promise<T> {
    return this.tracer.startActiveSpan('database.query', async (span) => {
      try {
        span.setAttribute('db.system', 'postgresql');
        span.setAttribute('db.statement', query);
        span.setAttribute('db.parameters', JSON.stringify(params || []));

        const result = await operation();

        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message,
        });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Cria um span para operações de cache
   */
  async createCacheSpan<T>(
    operation: 'get' | 'set' | 'delete',
    key: string,
    operationFn: () => Promise<T>,
  ): Promise<T> {
    return this.tracer.startActiveSpan(`cache.${operation}`, async (span) => {
      try {
        span.setAttribute('cache.operation', operation);
        span.setAttribute('cache.key', key);

        const result = await operationFn();

        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message,
        });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Adiciona atributos ao span atual
   */
  addAttributes(attributes: Record<string, any>): void {
    const currentSpan = trace.getActiveSpan();
    if (currentSpan) {
      Object.entries(attributes).forEach(([key, value]) => {
        currentSpan.setAttribute(key, value);
      });
    }
  }

  /**
   * Adiciona eventos ao span atual
   */
  addEvent(name: string, attributes?: Record<string, any>): void {
    const currentSpan = trace.getActiveSpan();
    if (currentSpan) {
      currentSpan.addEvent(name, attributes);
    }
  }

  /**
   * Obtém o trace ID atual
   */
  getCurrentTraceId(): string | undefined {
    const currentSpan = trace.getActiveSpan();
    return currentSpan?.spanContext().traceId;
  }

  /**
   * Obtém o span ID atual
   */
  getCurrentSpanId(): string | undefined {
    const currentSpan = trace.getActiveSpan();
    return currentSpan?.spanContext().spanId;
  }

  /**
   * Cria um span para operações de validação
   */
  async createValidationSpan<T>(
    entityType: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    return this.tracer.startActiveSpan('validation', async (span) => {
      try {
        span.setAttribute('validation.entity_type', entityType);
        span.setAttribute('validation.timestamp', new Date().toISOString());

        const result = await operation();

        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message,
        });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async traceHttpRequestLog(
    request: Request,
    log: LogContract,
  ): Promise<LogContract | undefined> {
    const start = process.hrtime.bigint();
    const spanName = `http.request.${request.method.toUpperCase()} ${request.path}`;
    return await this.tracer.startActiveSpan(spanName, async (span) => {
      const end = process.hrtime.bigint();
      const durationInNs = Number(end - start) / 1_000_000;

      const currentSpan = trace.getActiveSpan();
      if (currentSpan) {
        const spanContext = currentSpan.spanContext();

        log.trace = {
          traceId: spanContext.traceId,
          spanId: spanContext.spanId,
          traceFlags: spanContext.traceFlags,
        };

        log.host = {
          name: request.hostname || 'unknown',
          path: request.path || 'unknown',
          ip: request.ip || this.getClientIp(request),
          pid: request.app?.get('pid'),
        };

        log.method = request.method;

        log.context = {
          requestId: uuid(),
          correlationId: spanContext.traceId,
          url: request.url,
          userAgent: request.get('user-agent') || '',
        };

        log.responseTime = +durationInNs.toFixed(2);

        const requestProperties = {
          'http.request.method': request.method,
          'http.request.url': request.url,
          'http.request.host': request.host,
          'http.request.hostname': request.hostname,
          'http.request.user_agent': request.get('user-agent') || '',
          'http.request.ip': this.getClientIp(request),
          'log.type': log.type,
          'log.severity': log.severityText,
          'log.message': log.message,
          'log.service.name': log.service.name,
          'log.service.version': log.service.version,
          'log.timestamp': log.timestamp,
          'log.request_id': log.context?.requestId,
          'log.status_code': log.statusCode,
        };

        currentSpan.setAttributes(requestProperties);
      }

      try {
        span.setStatus({ code: SpanStatusCode.OK });
        return log;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message,
        });
      } finally {
        span.end();
      }
    });
  }

  private getClientIp(request: Request): string {
    if (request.headers?.['x-forwarded-for']) {
      return (request.headers?.['x-forwarded-for'] as string).split(',')[0];
    }
    if (request.headers?.['x-real-ip']) {
      return request.headers['x-real-ip'] as string;
    }
    if (request.socket?.remoteAddress) {
      return request.socket.remoteAddress;
    }
    return 'unknown';
  }
}
