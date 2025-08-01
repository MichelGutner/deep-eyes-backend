import { Module } from '@nestjs/common';
import { PrismaService } from './services/prisma.service';

export const PRISMA_SERVICE = 'PrismaService';
@Module({
  imports: [],
  providers: [
    {
      provide: PRISMA_SERVICE,
      useClass: PrismaService,
    },
  ],
  exports: [
    {
      provide: PRISMA_SERVICE,
      useClass: PrismaService,
    },
  ],
})
export class PrismaModule {}
