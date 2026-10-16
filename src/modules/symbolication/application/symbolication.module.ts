import { Module } from '@nestjs/common';
import { PrismaModule } from '@/modules/prisma';
import { SymbolsController } from './controllers/symbols.controller';
import { SymbolStoreService } from './services/symbol-store.service';
import { SymbolicationService } from './services/symbolication.service';

@Module({
  imports: [PrismaModule],
  controllers: [SymbolsController],
  providers: [SymbolStoreService, SymbolicationService],
  exports: [SymbolicationService],
})
export class SymbolicationModule {}
