import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { PRISMA_SERVICE } from '@/modules/prisma';
import { PrismaService } from '@/modules/prisma/application/services/prisma.service';
import { ESServiceInterface } from '@/modules/elasticsearch';

class CreateMetricDto {
  @IsString() name: string;
  @IsOptional() @IsString() description?: string;
  @IsString() type: string;
  @IsOptional() @IsString() unit?: string;
  @IsString() query: string;
  @IsOptional() @IsNumber() alertThreshold?: number;
  @IsOptional() @IsString() alertCondition?: string;
  @IsOptional() @IsString() chartType?: string;
}

@Controller('custom-metrics')
export class CustomMetricsController {
  constructor(
    @Inject(PRISMA_SERVICE) private readonly prisma: PrismaService,
    @Inject('ESService') private readonly esService: ESServiceInterface,
  ) {}

  @Get()
  async findAll() {
    const metrics = await this.prisma.customMetric.findMany({ orderBy: { created_at: 'desc' } });
    return { total: metrics.length, metrics };
  }

  @Post()
  async create(@Body() dto: CreateMetricDto) {
    return this.prisma.customMetric.create({ data: { ...dto, isActive: true } });
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: Partial<CreateMetricDto>) {
    return this.prisma.customMetric.update({ where: { id }, data: dto });
  }

  @Patch(':id')
  async patch(@Param('id') id: string, @Body() dto: { isActive?: boolean }) {
    return this.prisma.customMetric.update({ where: { id }, data: dto });
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.prisma.customMetric.delete({ where: { id } });
    return { success: true };
  }

  @Get(':id/data')
  async getData(@Param('id') id: string, @Query('timeRange') timeRange = '1h') {
    const metric = await this.prisma.customMetric.findUnique({ where: { id } });
    if (!metric) return { points: [] };
    // Execute the saved ES query (stored as level filter for now)
    const result = await this.esService.aggregateLogsByLevel('logs-*', timeRange) as any;
    const points = result.map((r: any, i: number) => ({
      timestamp: new Date(Date.now() - (result.length - i) * 3_600_000).toISOString(),
      value: r.sum,
      label: r.level,
    }));
    return { metric, points };
  }
}
