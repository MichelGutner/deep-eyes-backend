import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { TelemetryModuleOptions } from './telemetry.interface';
import { TELEMETRY_OPTIONS } from './telemetry.constants';
import { TelemetryManager } from './manager';

@Global()
@Module({})
export class TelemetryModule {
  static forRoot(options: TelemetryModuleOptions = {}): DynamicModule {
    const providers: Provider[] = [
      {
        provide: TELEMETRY_OPTIONS,
        useValue: options,
      },
      TelemetryManager
    ];

    return {
      module: TelemetryModule,
      providers,
      exports: [TelemetryManager],
      // No module imports required here; TelemetryManager is a provider
    };
  }
}
