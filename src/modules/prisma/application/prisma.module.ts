import { Module } from '@nestjs/common';
import { PrismaService } from './services/prisma.service';

@Module({
  imports: [],
  providers: [
    {
      provide: 'PrismaService',
      useClass: PrismaService,
    },
  ],
  exports: [
    {
      provide: 'PrismaService',
      useClass: PrismaService,
    },
  ],
})
export class PrismaModule {}
