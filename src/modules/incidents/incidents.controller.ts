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
import { IsOptional, IsString } from 'class-validator';
import { PRISMA_SERVICE } from '@/modules/prisma';
import { PrismaService } from '@/modules/prisma/application/services/prisma.service';

class UpdateIncidentDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() assignee?: string;
  @IsOptional() @IsString() rootCause?: string;
  @IsOptional() @IsString() resolution?: string;
}

class AddCommentDto {
  @IsString() userId: string;
  @IsString() description: string;
}

@Controller('incidents')
export class IncidentsController {
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
    const where: any = {};
    if (status) where.status = status;
    if (severity) where.severity = severity;
    const incidents = await this.prisma.incident.findMany({
      where,
      include: { comments: { orderBy: { created_at: 'asc' } } },
      take: limit ? Number(limit) : 100,
      orderBy: { created_at: 'desc' },
    });
    return { total: incidents.length, incidents };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.prisma.incident.findUnique({
      where: { id },
      include: { comments: { orderBy: { created_at: 'asc' } } },
    });
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateIncidentDto) {
    const data: any = {};
    if (dto.status) {
      data.status = dto.status;
      if (dto.status === 'resolved' || dto.status === 'closed') data.resolvedAt = new Date();
    }
    if (dto.assignee !== undefined) data.assignee = dto.assignee;
    if (dto.rootCause !== undefined) data.rootCause = dto.rootCause;
    if (dto.resolution !== undefined) data.resolution = dto.resolution;
    return this.prisma.incident.update({ where: { id }, data });
  }

  @Post(':id/comments')
  async addComment(@Param('id') incidentId: string, @Body() dto: AddCommentDto) {
    return this.prisma.incidentComment.create({
      data: { incidentId, userId: dto.userId, description: dto.description },
    });
  }
}
