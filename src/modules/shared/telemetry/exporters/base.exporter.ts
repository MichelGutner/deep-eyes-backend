import { LogEntity } from "@/modules/logs/domain";

export interface ExportResult {
  success: boolean;
  error?: Error;
  retryable?: boolean;
  statusCode?: number;
}

export abstract class BaseExporter {
  protected readonly name: string;

  constructor(protected readonly config: any) {
    this.name = this.constructor.name;
  }

  abstract connect(): Promise<void>;
  abstract export(events: LogEntity[]): Promise<ExportResult[]>;
  abstract shutdown(): Promise<void>;
  protected shouldProcess(event: LogEntity): boolean {
    // Lógica para decidir se o evento deve ser processado
    // Pode incluir sampling, filtros, etc.
    if (!event) {
      console.warn('Skipping empty event:', event);
      return false;
    }

    return true;
  }
}
