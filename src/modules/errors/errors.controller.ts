import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { ESServiceInterface } from '@/modules/elasticsearch';

@Controller('errors')
export class ErrorsController {
  constructor(
    @Inject('ESService')
    private readonly esService: ESServiceInterface,
  ) {}

  @Get()
  async getErrors(
    @Query('timeRange') timeRange = '7d',
    @Query('limit') limit?: string,
  ) {
    try {
      const groups = await this.esService.aggregateErrors(timeRange, limit ? Number(limit) : 500);
      return { total: groups.length, groups };
    } catch (err) {
      return { total: 0, groups: [], error: err?.message ?? String(err) };
    }
  }

  /** Full chronological occurrence history for one error group — backs the incident timeline view. */
  @Get(':fingerprint/occurrences')
  async getOccurrences(
    @Param('fingerprint') fingerprint: string,
    @Query('timeRange') timeRange = '30d',
    @Query('limit') limit?: string,
  ) {
    try {
      const occurrences = await this.esService.getErrorOccurrences(
        fingerprint,
        timeRange,
        limit ? Number(limit) : 50,
      );
      return { total: occurrences.length, occurrences };
    } catch (err) {
      return { total: 0, occurrences: [], error: err?.message ?? String(err) };
    }
  }
}
