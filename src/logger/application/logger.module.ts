import { Global, Module } from '@nestjs/common';

import { PinoLogger, LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { AppLoggerService } from './services';

const date = new Date(Date.now()).toLocaleString('pt-BR');

export const pinoHttp = {
  name: process.env.APP_NAME,
  level: 'info',
  transport: { target: 'pino-pretty' },
  redact: {
    paths: ['req.headers.authorization'],
    censor: '[Batch Redacted]',
  },
  timestamp: () => `,"time":"${date}"`,
  genReqId: (req) => req.headers['x-request-id'],
};

@Global()
@Module({
  imports: [PinoLoggerModule.forRoot({ pinoHttp })],
  providers: [
    AppLoggerService,
    {
      provide: 'Logger',
      useExisting: AppLoggerService,
    },
    {
      provide: 'PinoLogger',
      useClass: PinoLogger,
    },
  ],
  exports: [{ provide: 'Logger', useClass: AppLoggerService }],
})
export class LoggerModule {}
