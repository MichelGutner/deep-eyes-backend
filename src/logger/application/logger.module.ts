import { Global, Module } from '@nestjs/common';
import { ApplicationLogger } from './services';
@Global()
@Module({
  imports: [],
  providers: [
    ApplicationLogger,
    {
      provide: 'Logger',
      useExisting: ApplicationLogger,
    },
  ],
  exports: [{ provide: 'Logger', useClass: ApplicationLogger }],
})
export class LoggerModule {}
