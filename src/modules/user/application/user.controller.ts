import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { randomBytes } from 'crypto';
import { PRISMA_SERVICE } from '@/modules/prisma';
import { PrismaService } from '@/modules/prisma/application/services/prisma.service';

class PatchUserDto {
  status?: 'active' | 'inactive';
  role?: string;
}

@Controller('users')
export class UserController {
  constructor(
    @Inject(PRISMA_SERVICE)
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async findAll(@Req() req: Request) {
    const orgId = (req as any).user?.organizationId;
    const where = orgId ? { organization_id: orgId } : {};
    const users = await this.prisma.user.findMany({
      where,
      select: { id: true, email: true, name: true, role: true, status: true, lastActive: true, created_at: true, organization_id: true },
      orderBy: { created_at: 'desc' },
    });
    return { total: users.length, users };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: PatchUserDto) {
    return this.prisma.user.update({
      where: { id: Number(id) },
      data: { ...(dto.status && { status: dto.status as any }), ...(dto.role && { role: dto.role as any }) },
      select: { id: true, email: true, name: true, role: true, status: true, lastActive: true },
    });
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.prisma.user.delete({ where: { id: Number(id) } });
    return { success: true };
  }

  @Post('invite')
  async invite(@Body() body: { email: string; role?: string }, @Req() req: Request) {
    const orgId = (req as any).user?.organizationId;
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 48 * 3_600_000); // 48h

    return {
      inviteLink: `/register?invite=${token}&org=${orgId}&email=${encodeURIComponent(body.email)}`,
      token,
      email: body.email,
      expiresAt,
      message: 'Share this link with the user. It expires in 48 hours.',
    };
  }
}
