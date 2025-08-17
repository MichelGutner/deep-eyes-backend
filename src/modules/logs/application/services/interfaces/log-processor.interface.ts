import { LogEntity } from "@/modules/logs/domain";

export type LogProcessorInterface = {
  enqueueLog: (log: LogEntity) => void;
};
