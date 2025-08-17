import { Injectable } from '@nestjs/common';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { TracingServiceInterface } from './interfaces/tracing.interface';
import { LogEntity } from '@/modules/logs/domain';

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

  async addTraceInfoToLog(log: LogEntity): Promise<LogEntity> {
    const spanName = `http.request.${log.level?.toLowerCase()}`;
    return await this.tracer.startActiveSpan(spanName, async (span) => {
      const currentSpan = trace.getActiveSpan();

      if (currentSpan) {
        const spanContext = currentSpan.spanContext();
        log.trace = {
          traceId: spanContext.traceId,
          spanId: spanContext.spanId,
          traceFlags: spanContext.traceFlags,
        };
      }

      try {
        span.setStatus({ code: SpanStatusCode.OK });
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message,
        });
      } finally {
        span.end();
        return log;
      }
    });
  }
}
