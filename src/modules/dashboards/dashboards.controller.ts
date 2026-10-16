import { Body, Controller, Delete, Get, Inject, Param, Post, Put, Req } from '@nestjs/common';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { Request } from 'express';
import { PRISMA_SERVICE } from '@/modules/prisma';
import { PrismaService } from '@/modules/prisma/application/services/prisma.service';

class CreateDashboardDto {
  @IsString() name: string;
  @IsOptional() @IsBoolean() isPublic?: boolean;
}

class CreateWidgetDto {
  @IsString() type: string;
  @IsString() title: string;
  @IsOptional() config?: Record<string, unknown>;
  @IsOptional() @IsNumber() posX?: number;
  @IsOptional() @IsNumber() posY?: number;
  @IsOptional() @IsNumber() width?: number;
  @IsOptional() @IsNumber() height?: number;
}

@Controller('dashboards')
export class DashboardsController {
  constructor(@Inject(PRISMA_SERVICE) private readonly prisma: PrismaService) {}

  @Get()
  async findAll(@Req() req: Request) {
    const dashboards = await this.prisma.dashboard.findMany({
      include: { widgets: { orderBy: [{ posY: 'asc' }, { posX: 'asc' }] } },
      orderBy: { updated_at: 'desc' },
    });
    return { total: dashboards.length, dashboards };
  }

  @Post()
  async create(@Body() dto: CreateDashboardDto, @Req() req: Request) {
    return this.prisma.dashboard.create({
      data: { name: dto.name, isPublic: dto.isPublic ?? false },
      include: { widgets: true },
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.prisma.dashboard.findUnique({
      where: { id },
      include: { widgets: { orderBy: [{ posY: 'asc' }, { posX: 'asc' }] } },
    });
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: Partial<CreateDashboardDto>) {
    return this.prisma.dashboard.update({
      where: { id },
      data: dto,
      include: { widgets: true },
    });
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.prisma.dashboard.delete({ where: { id } });
    return { success: true };
  }

  @Post(':id/widgets')
  async addWidget(@Param('id') dashboardId: string, @Body() dto: CreateWidgetDto) {
    return this.prisma.widget.create({
      data: {
        dashboardId,
        type: dto.type,
        title: dto.title,
        config: (dto.config ?? {}) as any,
        posX: dto.posX ?? 0,
        posY: dto.posY ?? 0,
        width: dto.width ?? 4,
        height: dto.height ?? 3,
      },
    });
  }

  @Put(':id/widgets/:widgetId')
  async updateWidget(
    @Param('id') dashboardId: string,
    @Param('widgetId') widgetId: string,
    @Body() dto: Partial<CreateWidgetDto>,
  ) {
    return this.prisma.widget.update({
      where: { id: widgetId },
      data: { ...dto, config: dto.config as any },
    });
  }

  @Delete(':id/widgets/:widgetId')
  async removeWidget(@Param('id') _dashboardId: string, @Param('widgetId') widgetId: string) {
    await this.prisma.widget.delete({ where: { id: widgetId } });
    return { success: true };
  }
}
