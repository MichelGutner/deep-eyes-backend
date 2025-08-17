import { LogEntity } from '@/modules/shared/telemetry/domain';

export type LogProcessorInterface = {
  enqueueLog: (log: LogEntity) => void;
};
