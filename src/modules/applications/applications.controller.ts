import { Body, Controller, Get, Inject, Param, Post, Req } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { Request } from 'express';
import { PRISMA_SERVICE } from '@/modules/prisma';
import { PrismaService } from '@/modules/prisma/application/services/prisma.service';

class CreateApplicationDto {
  @IsString() name: string;
  @IsString() organization_id: string;
  @IsOptional() @IsString() environment?: string;
  @IsOptional() @IsString() version?: string;
}

@Controller('applications')
export class ApplicationsController {
  constructor(
    @Inject(PRISMA_SERVICE)
    private readonly prisma: PrismaService,
  ) {}

  // POST is unguarded — called during onboarding before auth
  @Post()
  async create(@Body() dto: CreateApplicationDto) {
    return this.prisma.application.create({
      data: {
        name: dto.name,
        organization_id: dto.organization_id,
        environment: dto.environment ?? 'development',
        version: dto.version,
      },
      select: { id: true, name: true, apiKey: true, environment: true, version: true, created_at: true },
    });
  }

  @Get()
  async findAll(@Req() req: Request) {
    const orgId = (req as any).user?.organizationId;
    const where = orgId ? { organization_id: orgId } : {};
    return this.prisma.application.findMany({
      where,
      select: { id: true, name: true, apiKey: true, environment: true, version: true, created_at: true },
      orderBy: { created_at: 'desc' },
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.prisma.application.findUnique({
      where: { id },
      select: { id: true, name: true, apiKey: true, environment: true, version: true, created_at: true },
    });
  }
}
