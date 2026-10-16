import { Module } from '@nestjs/common';
import { RealtimeController } from './realtime.controller';
import { RealtimeService } from './realtime.service';
import { AuthModule } from '../auth';

@Module({
  imports: [AuthModule],
  controllers: [RealtimeController],
  providers: [
    {
      provide: 'RealtimeService',     
      useClass: RealtimeService,
    },
  ],
})
export class RealtimeModule {}
