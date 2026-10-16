import { Controller, Get, Inject, MessageEvent, Query, Sse } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Observable, interval } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { RealtimeService } from './realtime.service';

@Controller('realtime')
export class RealtimeController {
  constructor(
    @Inject('RealtimeService')
    private readonly realtimeService: RealtimeService,
  ) {}

  @Get()
  getRealtime(@Query('timeRange') timeRange = '1m') {
    return this.realtimeService.getRealtimeMetrics(timeRange);
  }

  @SkipThrottle()
  @Sse('stream')
  stream(): Observable<MessageEvent> {
    return interval(5000).pipe(
      switchMap(() => this.realtimeService.getRealtimeMetrics('1m')),
      map((data) => ({ data } as MessageEvent)),
    );
  }
}
