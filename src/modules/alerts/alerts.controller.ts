import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { IsBoolean, IsEnum, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';
import { PRISMA_SERVICE } from '@/modules/prisma';
import { PrismaService } from '@/modules/prisma/application/services/prisma.service';

class UpdateAlertDto {
  @IsOptional() @IsString() status?: 'active' | 'acknowledged' | 'resolved';
  @IsOptional() @IsString() assignedTo?: string;
}

class CreateAlertRuleDto {
  @IsString() name: string;
  @IsString() condition: string;
  @IsNumber() threshold: number;
  @IsString() metric: string;
  @IsString() severity: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsObject() notifications: { email: boolean; slack: boolean; webhook: boolean };
}

class UpdateAlertRuleDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsNumber() threshold?: number;
  @IsOptional() @IsString() severity?: string;
  @IsOptional() @IsObject() notifications?: { email: boolean; slack: boolean; webhook: boolean };
}

@Controller('alerts')
export class AlertsController {
  constructor(
    @Inject(PRISMA_SERVICE)
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async findAll(
    @Query('status') status?: string,
    @Query('severity') severity?: string,
    @Query('limit') limit?: string,
  ) {
    // TODO: Alert model has no organization_id — add org isolation once the schema is updated
    const where: any = {};
    if (status) where.status = status;
    if (severity) where.severity = severity;
    const alerts = await this.prisma.alert.findMany({
      where,
      take: limit ? Number(limit) : 100,
      orderBy: { created_at: 'desc' },
    });
    return { total: alerts.length, alerts };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateAlertDto) {
    return this.prisma.alert.update({
      where: { id },
      data: { ...(dto.status && { status: dto.status }), ...(dto.assignedTo !== undefined && { assignedTo: dto.assignedTo }) },
    });
  }

  @Get('rules')
  async findRules() {
    const rules = await this.prisma.alertRule.findMany({ orderBy: { created_at: 'desc' } });
    return { total: rules.length, rules };
  }

  @Post('rules')
  async createRule(@Body() dto: CreateAlertRuleDto) {
    return this.prisma.alertRule.create({ data: { ...dto, enabled: dto.enabled ?? true } });
  }

  @Patch('rules/:id')
  async updateRule(@Param('id') id: string, @Body() dto: UpdateAlertRuleDto) {
    return this.prisma.alertRule.update({ where: { id }, data: dto });
  }
}
