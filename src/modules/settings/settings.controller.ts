import { Body, Controller, Get, Inject, Put, Req } from '@nestjs/common';
import { Request } from 'express';
import { PRISMA_SERVICE } from '@/modules/prisma';
import { PrismaService } from '@/modules/prisma/application/services/prisma.service';

@Controller('settings')
export class SettingsController {
  constructor(@Inject(PRISMA_SERVICE) private readonly prisma: PrismaService) {}

  @Get()
  async get(@Req() req: Request) {
    const orgId = (req as any).user?.organizationId;
    const settings = await this.prisma.organizationSettings.findUnique({
      where: { organizationId: orgId },
    });
    if (!settings) {
      // return defaults
      return {
        notifications: { email: true, slack: false, webhook: false, slackWebhook: '', webhookUrl: '' },
        security: { mfa: false, sessionTimeout: 24, passwordPolicy: 'standard', ipWhitelist: [] },
        display: { theme: 'system', timezone: 'UTC', refreshInterval: 30, dateFormat: 'relative' },
      };
    }
    return settings;
  }

  @Put()
  async update(@Body() dto: any, @Req() req: Request) {
    const orgId = (req as any).user?.organizationId;
    return this.prisma.organizationSettings.upsert({
      where: { organizationId: orgId },
      update: {
        ...(dto.notifications && { notifications: dto.notifications }),
        ...(dto.security && { security: dto.security }),
        ...(dto.display && { display: dto.display }),
      },
      create: {
        organizationId: orgId,
        notifications: dto.notifications ?? {},
        security: dto.security ?? {},
        display: dto.display ?? {},
      },
    });
  }
}
