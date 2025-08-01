import { Inject, Injectable, LoggerService } from '@nestjs/common';
import { Logger } from './interfaces';

@Injectable()
export class AppLoggerService implements LoggerService {
  constructor(@Inject('PinoLogger') private readonly logger: Logger) {}
  log(message: any, ...optionalParams: any[]) {
    this.logger.info(optionalParams, message);
  }
  error(message: any, ...optionalParams: any[]) {
    this.logger.error(optionalParams, message);
  }
  warn(message: any, ...optionalParams: any[]) {
    this.logger.warn(optionalParams, message);
  }
  debug?(message: any, ...optionalParams: any[]) {
    this.logger.debug(optionalParams, message);
  }
  verbose?(message: any, ...optionalParams: any[]) {
    this.logger.trace(optionalParams, message);
  }

  fatal(message: any, ...optionalParams: any[]) {
    this.logger.fatal(optionalParams, message);
  }

  trace(message: any, ...optionalParams: any[]) {
    this.logger.trace(optionalParams, message);
  }

  info(message: any, ...optionalParams: any[]) {
    this.logger.info(optionalParams, message);
  }
}
