import { ModuleMetadata, Type } from '@nestjs/common';

export interface TelemetryModuleOptions {
  kafka?: {
    brokers: string[];
    topic?: string;
    clientId?: string;
    groupId?: string;
    ssl?: boolean;
    sasl?: {
      mechanism: 'plain' | 'scram-sha-256' | 'scram-sha-512';
      username: string;
      password: string;
    };
  };
  //   elasticsearch?: {
  //     node: string;
  //     auth?: {
  //       username: string;
  //       password: string;
  //     };
  //     index?: string;
  //   };
  bufferSize?: number;
  batchSize?: number;
  flushIntervalMs?: number;
  enabled?: boolean;
  defaultSamplingRate?: number;
}

export interface TelemetryOptionsFactory {
  createTelemetryOptions():
    | Promise<TelemetryModuleOptions>
    | TelemetryModuleOptions;
}

export interface TelemetryModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  useExisting?: Type<TelemetryOptionsFactory>;
  useClass?: Type<TelemetryOptionsFactory>;
  useFactory?: (
    ...args: any[]
  ) => Promise<TelemetryModuleOptions> | TelemetryModuleOptions;
  inject?: any[];
}
