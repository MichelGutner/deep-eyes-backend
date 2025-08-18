import {
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';

@Injectable()
export class ApplicationLogger extends Logger {
  constructor() {
    super(ApplicationLogger.name);
  }

  log(message: any, ...optionalParams: [...any, string?]) {
    super.log(message, ...optionalParams);
  }

  error(message: any, ...optionalParams: any[]) {
    super.error(message, ...optionalParams);
  }

  warn(message: any, ...optionalParams: any[]) {
    super.warn(message, ...optionalParams);
  }

  debug(message: any, ...optionalParams: any[]) {
    super.debug(message, ...optionalParams);
  }

  verbose(message: any, ...optionalParams: any[]) {
    super.verbose(message, ...optionalParams);
  }

  fatal(message: any, ...optionalParams: any[]) {
    super.error('[FATAL]', message, ...optionalParams);
  }
}
