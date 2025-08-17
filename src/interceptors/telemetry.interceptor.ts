import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { context, trace } from '@opentelemetry/api';
import { Request, Response } from 'express';
import { tap } from 'rxjs';

@Injectable()
export class TelemetryInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler) {
    const request = ctx.switchToHttp().getRequest<Request>();
    const response = ctx.switchToHttp().getResponse<Response>();

    const currentSpan = trace.getSpan(context.active());

    const startTime = process.hrtime();

    if (currentSpan) {
      currentSpan.setAttributes({
        'http.request.method': request.method,
        'http.request.url': request.originalUrl || request.url,
        'http.request.headers': JSON.stringify(request.headers),
        'http.request.user_agent': request.headers['user-agent'] || '',
        'http.request.ip': request.ip || request.socket?.remoteAddress || '',
        'http.request.query': JSON.stringify(request.query),
        'http.request.body': JSON.stringify(request.body || {}),
        'http.request.content_length': request.headers['content-length'] || 0,
      });

      currentSpan.addEvent('the.logs', {
        'http.request.method': request.method,
        'http.request.url': request.originalUrl || request.url,
        'http.request.headers': JSON.stringify(request.headers),
        'http.request.user_agent': request.headers['user-agent'] || '',
        'http.request.ip': request.ip || request.socket?.remoteAddress || '',
        'http.request.query': JSON.stringify(request.query),
        'http.request.body': JSON.stringify(request.body || {}),
        'http.request.content_length': request.headers['content-length'] || 0,
      });
      currentSpan.addEvent('http.request.received');
    }

    return next.handle().pipe(
      tap(() => {
        const duration = process.hrtime(startTime);
        const durationMs = duration[0] * 1000 + duration[1] / 1e6;

        // Re-fetch the active span to avoid operating on a span that may have been ended elsewhere
        const activeSpan = trace.getSpan(context.active());
        if (activeSpan) {
          activeSpan.setAttributes({
            'http.response.status_code': response.statusCode,
            'http.response.duration_ms': durationMs,
          });

          activeSpan.addEvent('http.response.sent');
          // Do not end span here; HTTP instrumentation will end it.
        }

        response.setHeader('X-Response-Time', `${durationMs.toFixed(2)}ms`);
      }),
    );
  }
}
